"""A worker over WORKER_MAX_RSS_MB after a job restarts in place: same pid, fresh memory."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from backend import cli, preflight, worker
from backend.settings import get_settings

SCRIPT = """
import os, sys
from backend import worker
if os.environ.get("ARI_TEST_RESTARTED"):
    print("restarted", os.getpid(), os.environ.get("WORKER_RECYCLED"), flush=True)
    sys.exit(0)
def run_one(owner, kinds=None):
    os.environ["ARI_TEST_RESTARTED"] = "1"
    print("job", os.getpid(), flush=True)
    return "job"
worker.run_one = run_one
sys.exit(worker.main([]))
"""


def _run(limit: str) -> subprocess.Popen[str]:
    env = {
        **os.environ,
        "WORKER_MAX_RSS_MB": limit,
        "PYTHONPATH": os.pathsep.join(
            str(Path(__file__).resolve().parents[2] / d)
            for d in ("backend", "shared", "monitoring", "standards")
        ),
    }
    env.pop("ARI_TEST_RESTARTED", None)
    env.pop("WORKER_RECYCLED", None)
    return subprocess.Popen(
        [sys.executable, "-c", SCRIPT], stdout=subprocess.PIPE, text=True, env=env
    )


@pytest.mark.skipif(worker.rss_mb() is None, reason="needs /proc")
def test_worker_over_the_limit_restarts_in_place_after_its_job():
    proc = _run("1")
    out, _ = proc.communicate(timeout=60)
    assert proc.returncode == 0
    first, second = (line.split() for line in out.strip().splitlines())
    assert (first[0], second[0]) == ("job", "restarted")
    assert first[1] == second[1] == str(proc.pid)
    assert second[2] == "1"


@pytest.mark.parametrize("recycled", [True, False])
def test_recycled_worker_skips_the_migration_check(monkeypatch, recycled):
    """A rolling deploy migrates the database under the old container's workers."""

    def behind() -> None:
        raise SystemExit("preflight migration check failed")

    monkeypatch.setattr(preflight, "require_config", lambda **_: None)
    monkeypatch.setattr(preflight, "require_migrated", behind)
    monkeypatch.setattr(worker, "main", lambda: 0)
    monkeypatch.setattr("backend.ops_logging.configure_logging", lambda: None)
    if recycled:
        monkeypatch.setenv(preflight.RECYCLED_ENV, "1")
    else:
        monkeypatch.delenv(preflight.RECYCLED_ENV, raising=False)
    with pytest.raises(SystemExit) as exit_:
        cli.worker()
    assert exit_.value.code == (0 if recycled else "preflight migration check failed")


@pytest.mark.skipif(worker.rss_mb() is None, reason="needs /proc")
def test_worker_under_the_limit_keeps_running():
    proc = _run("100000")
    try:
        assert proc.stdout is not None
        assert proc.stdout.readline().split()[0] == "job"
        assert proc.stdout.readline().split()[0] == "job"  # same process took the next job
    finally:
        proc.kill()
        proc.wait()


def test_limit_is_off_by_default(monkeypatch):
    monkeypatch.delenv("WORKER_MAX_RSS_MB", raising=False)
    get_settings.cache_clear()
    try:
        assert get_settings().worker_max_rss_mb == 0
        assert worker.over_memory_limit() is False
    finally:
        get_settings.cache_clear()
