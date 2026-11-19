"""Starts workers only while jobs are waiting (deploy/railway/start.sh, WORKER_ON_DEMAND).

    hackatl-worker-pool --max 3

An idle worker holds its memory all month; this one process stands in for all of them. Each
tick it counts the jobs a worker could claim now and starts workers until each of those jobs
has an idle worker, up to ``--max``. A worker it starts exits after ``WORKER_IDLE_EXIT_S``
with nothing to claim. With no worker running nobody else would recover expired leases or
promote waiting jobs, so the pool runs the periodic reconcile too, and it beats a ``pool:``
row in ``worker_heartbeats`` so /readyz knows queued jobs will be picked up.
"""

from __future__ import annotations

import argparse
import logging
import os
import signal
import socket
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Protocol

from backend import jobs
from backend.db import transaction
from backend.preflight import RECYCLED_ENV
from backend.settings import get_settings
from backend.worker import reconcile_safely, worker_id

log = logging.getLogger("backend.worker_pool")

DEFAULT_IDLE_EXIT_S = 60.0
# A worker that dies this soon after starting never got to a job.
FAILED_START_S = 10.0
MAX_FAILED_STARTS = 3


class Process(Protocol):
    pid: int

    def poll(self) -> int | None: ...
    def terminate(self) -> None: ...
    def wait(self) -> int: ...


class WorkersKeepFailing(RuntimeError):
    """Workers exit right after starting; stop so the supervisor restarts the service."""


def start_worker() -> Process:
    env = {
        **os.environ,
        RECYCLED_ENV: "1",
        "WORKER_IDLE_EXIT_S": str(get_settings().worker_idle_exit_s or DEFAULT_IDLE_EXIT_S),
    }
    return subprocess.Popen(
        [sys.executable, "-c", "from backend.cli import worker; worker()"], env=env
    )


@dataclass
class Pool:
    max_workers: int
    start: Callable[[], Process] = start_worker
    owner: str = field(default_factory=lambda: f"pool:{worker_id()}")
    children: dict[int, tuple[Process, float]] = field(default_factory=dict)
    failed_starts: int = 0

    def reap(self) -> None:
        for pid, (proc, started) in list(self.children.items()):
            code = proc.poll()
            if code is None:
                continue
            del self.children[pid]
            if code == 0:
                self.failed_starts = 0
                continue
            log.warning("worker pid %d exited with %d", pid, code)
            if time.monotonic() - started < FAILED_START_S:
                self.failed_starts += 1
            else:
                self.failed_starts = 0  # died mid-run: its job's lease expires and is recovered
        if self.failed_starts >= MAX_FAILED_STARTS:
            raise WorkersKeepFailing(f"{self.failed_starts} workers in a row failed to start")

    def tick(self) -> int:
        """Start a worker for each claimable job that has no idle one. Returns how many."""
        self.reap()
        host = socket.gethostname()
        with transaction() as conn:
            jobs.worker_heartbeat(conn, self.owner, poll=True)
            waiting = jobs.claimable_count(conn)
            busy = jobs.busy_workers(conn, [f"{host}:{pid}" for pid in self.children])
        idle = len(self.children) - busy  # a worker still starting counts as idle
        wanted = max(0, min(waiting - idle, self.max_workers - len(self.children)))
        for _ in range(wanted):
            proc = self.start()
            self.children[proc.pid] = (proc, time.monotonic())
            log.info("started worker pid %d (%d waiting)", proc.pid, waiting)
        return wanted

    def stop(self) -> None:
        """Workers finish the job in hand on TERM; wait for them."""
        for proc, _ in self.children.values():
            proc.terminate()
        for proc, _ in self.children.values():
            proc.wait()
        self.children.clear()
        try:
            with transaction() as conn:
                jobs.worker_stopped(conn, self.owner)
        except Exception:  # pragma: no cover - the stale row ages out of the active count
            log.warning("could not deregister %s", self.owner, exc_info=True)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--max", type=int, default=3, help="most workers running at once")
    a = p.parse_args(argv)
    logging.basicConfig(
        level=get_settings().log_level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    pool = Pool(max(1, a.max))
    stopping = threading.Event()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, lambda *_: stopping.set())
    log.info("worker pool %s started (up to %d workers)", pool.owner, pool.max_workers)
    reconcile_safely()
    last_reconcile = time.monotonic()
    code = 0
    while not stopping.is_set():
        s = get_settings()
        pause = s.worker_poll_interval_s
        try:
            pool.tick()
        except WorkersKeepFailing as exc:
            log.error("%s; stopping", exc)
            code = 1
            break
        except Exception:
            log.exception("worker pool tick failed; retrying")
            pause = max(pause, 5.0)
        if time.monotonic() - last_reconcile >= s.worker_reconcile_interval_s:
            reconcile_safely()
            last_reconcile = time.monotonic()
        stopping.wait(pause)
    pool.stop()
    log.info("worker pool %s stopped", pool.owner)
    return code


if __name__ == "__main__":
    raise SystemExit(main())
