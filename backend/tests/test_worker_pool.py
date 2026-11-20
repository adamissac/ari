"""The worker pool starts a worker when a job is claimable and none is idle; workers it
starts leave once idle (deploy/railway/start.sh, WORKER_ON_DEMAND)."""

import signal
import socket
import time

import pytest
import sqlalchemy as sa

from backend import jobs, worker, worker_pool
from backend.db import transaction
from backend.ops import readiness
from backend.settings import get_settings

STOP = "live_defense_emergency_stop"


class FakeProc:
    def __init__(self, pid: int) -> None:
        self.pid = pid
        self.code: int | None = None
        self.terminated = False

    def poll(self) -> int | None:
        return self.code

    def terminate(self) -> None:
        self.terminated = True

    def wait(self) -> int:
        return self.code or 0


def _pool(max_workers: int = 3) -> tuple[worker_pool.Pool, list[FakeProc]]:
    started: list[FakeProc] = []

    def start() -> FakeProc:
        started.append(FakeProc(1000 + len(started)))
        return started[-1]

    return worker_pool.Pool(max_workers, start=start), started


def _enqueue(kind: str = "pool_job") -> str:
    with transaction() as conn:
        jid, _ = jobs.enqueue(conn, kind, {"project_id": "prj_a"})
    return jid


def _claim(pid: int) -> None:
    """The worker with this pid takes the next job, as its claim loop would."""
    owner = f"{socket.gethostname()}:{pid}"
    with transaction() as conn:
        job = jobs.claim(conn, owner, lease_s=60)
        assert job is not None
        jobs.worker_heartbeat(conn, owner, job_id=job.id, poll=True)


def _claimable() -> int:
    with transaction() as conn:
        return jobs.claimable_count(conn)


def test_claimable_count_applies_the_global_cap_and_the_emergency_reserve(settings_override):
    settings_override(job_max_running_global="2", job_max_running_emergency="1")
    for _ in range(3):
        _enqueue()
    assert _claimable() == 2
    _claim(1)
    assert _claimable() == 1
    _claim(2)
    assert _claimable() == 0  # the third ordinary job waits behind the cap
    _enqueue(STOP)
    _enqueue(STOP)
    assert _claimable() == 1  # one emergency slot, outside the ordinary cap


def test_claimable_count_skips_delayed_and_cancelled_jobs():
    with transaction() as conn:
        jobs.enqueue(conn, "pool_job", {"project_id": "prj_a"}, delay_s=600)
        jid, _ = jobs.enqueue(conn, "pool_job", {"project_id": "prj_a"})
        jobs.request_cancel(conn, jid)
    assert _claimable() == 0


def test_pool_starts_nothing_for_an_empty_queue_and_keeps_readyz_passing(settings_override):
    settings_override(readyz_require_workers="true")
    assert readiness(get_settings())[0]["status"] != "ready"
    pool, started = _pool()
    assert pool.tick() == 0 and started == []
    body, code = readiness(get_settings())
    assert (code, body["status"], body["workers"]["alive"]) == (200, "ready", 1)
    pool.stop()
    assert readiness(get_settings())[0]["workers"]["alive"] == 0


def test_pool_starts_one_worker_per_claimable_job_without_an_idle_worker(settings_override):
    settings_override(job_max_running_global="2")
    pool, started = _pool()
    _enqueue()
    assert pool.tick() == 1
    assert pool.tick() == 0  # the worker it just started has not claimed yet: it is idle
    _claim(started[0].pid)
    assert pool.tick() == 0  # nothing waiting
    _enqueue()
    assert pool.tick() == 1  # the only worker is busy
    _claim(started[1].pid)
    _enqueue()
    assert pool.tick() == 0  # both ordinary slots are taken; a third worker could not claim
    _enqueue(STOP)
    assert pool.tick() == 1  # the emergency job gets the last worker
    _claim(started[2].pid)
    _enqueue(STOP)
    assert pool.tick() == 0 and len(started) == 3  # never more than max_workers


def test_pool_forgets_workers_that_left_and_stops_the_rest():
    pool, started = _pool()
    _enqueue()
    _enqueue()
    assert pool.tick() == 2
    started[0].code = 0  # idle exit
    assert pool.tick() == 1 and len(pool.children) == 2
    pool.stop()
    assert [p.terminated for p in started] == [False, True, True] and not pool.children


def test_pool_gives_up_when_workers_keep_dying_at_startup():
    pool, started = _pool(max_workers=1)
    _enqueue()
    for _ in range(worker_pool.MAX_FAILED_STARTS - 1):
        pool.tick()
        started[-1].code = 1
    pool.tick()
    started[-1].code = 1
    with pytest.raises(worker_pool.WorkersKeepFailing):
        pool.tick()


def test_a_worker_that_died_mid_run_is_replaced_not_fatal(monkeypatch):
    pool, started = _pool(max_workers=1)
    _enqueue()
    for _ in range(worker_pool.MAX_FAILED_STARTS + 1):
        pool.tick()
        proc, _started_at = pool.children[started[-1].pid]
        pool.children[proc.pid] = (proc, time.monotonic() - worker_pool.FAILED_START_S - 1)
        started[-1].code = -9
    assert pool.tick() == 1


def test_worker_exits_after_the_idle_limit(settings_override, monkeypatch):
    settings_override(worker_idle_exit_s="0.2", worker_poll_interval_s="0.05")
    monkeypatch.setattr(signal, "signal", lambda *a: None)
    began = time.monotonic()
    assert worker.main([]) == 0
    assert 0.2 <= time.monotonic() - began < 10
    with transaction() as conn:
        assert jobs.live_workers(conn, 30) == []  # it deregistered


@pytest.mark.parametrize("max_rss_mb", ["0", "1"])  # 1: it also recycles itself after the job
def test_pool_runs_a_real_worker_that_takes_the_job_and_leaves(settings_override, max_rss_mb):
    settings_override(
        worker_idle_exit_s="1", worker_poll_interval_s="0.1", worker_max_rss_mb=max_rss_mb
    )
    jid = _enqueue("pool_kind_without_a_handler")  # the worker fails it permanently
    pool = worker_pool.Pool(1)
    assert pool.tick() == 1
    (proc, _started_at) = next(iter(pool.children.values()))
    try:
        assert proc.wait(timeout=60) == 0
    finally:
        pool.stop()
    with transaction() as conn:
        row = conn.execute(
            sa.text("SELECT status, attempts FROM jobs WHERE id = :id"), {"id": jid}
        ).one()
    assert (row.status, row.attempts) == ("failed", 1)
    assert pool.tick() == 0 and not pool.children
