"""Build-context checks without a Docker daemon; Linux image proof is separate."""

from __future__ import annotations

import re
import shutil
import subprocess
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_backend_image_copies_every_workspace_member(tmp_path: Path) -> None:
    dockerfile = (ROOT / "backend/Dockerfile").read_text()
    members = tomllib.loads((ROOT / "pyproject.toml").read_text())["tool"]["uv"]["workspace"][
        "members"
    ]
    for member in members:
        assert re.search(rf"^COPY {re.escape(member)}/ {re.escape(member)}/$", dockerfile, re.M), (
            member
        )
    # Reconstruct the Docker COPY inputs, then resolve the frozen lock without
    # creating/installing an environment or executing target source.
    for name in ("pyproject.toml", "uv.lock"):
        shutil.copy(ROOT / name, tmp_path / name)
    for member in members:
        shutil.copytree(
            ROOT / member,
            tmp_path / member,
            ignore=shutil.ignore_patterns(
                ".venv", "__pycache__", ".pytest_cache", ".mypy_cache", ".ruff_cache", "*.egg-info"
            ),
        )
    result = subprocess.run(
        [
            "uv",
            "sync",
            "--python",
            "3.12",
            "--frozen",
            "--no-dev",
            "--dry-run",
            "--project",
            str(tmp_path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr


def test_build_context_excludes_local_credentials_and_artifacts() -> None:
    patterns = set((ROOT / ".dockerignore").read_text().splitlines())
    assert {
        ".git",
        ".dev",
        ".serena",
        "**/.env",
        "**/.env.*",
        "**/*.pem",
        "**/*.key",
        "**/.venv",
        "**/node_modules",
        "hackatl-agentic-security",
    } <= patterns
    assert "!**/.env.example" in patterns


def _railway_workers(tmp_path: Path, **env: str) -> list[str]:
    """Run the Railway entrypoint with stub binaries; return each worker's ordinary-job cap."""
    seen = tmp_path / "workers"
    stubs = {
        "hackatl-preflight": "exit 0",
        "hackatl-migrate": "exit 0",
        "python": "exit 0",
        "hackatl-worker": f'echo "${{JOB_MAX_RUNNING_GLOBAL-unset}}" >> {seen}\nexec sleep 30',
        "hackatl-worker-pool": (
            f'echo "pool $* ${{JOB_MAX_RUNNING_GLOBAL-unset}}" >> {seen}\nexec sleep 30'
        ),
        "hackatl-api": "sleep 1",  # exits, so the supervisor stops the workers and returns
    }
    for name, body in stubs.items():
        stub = tmp_path / name
        stub.write_text(f"#!/bin/sh\n{body}\n")
        stub.chmod(0o755)
    path = f"{tmp_path}:/usr/bin:/bin"
    result = subprocess.run(
        ["sh", str(ROOT / "deploy/railway/start.sh")],
        env={"PATH": path, **env},
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 1, result.stderr
    return seen.read_text().split()


def test_railway_starts_workers_on_demand_with_one_kept_free_for_emergency_jobs(
    tmp_path: Path,
) -> None:
    # Emergency stop/rollback/expiry are claimed outside JOB_MAX_RUNNING_GLOBAL, so a cap
    # one below the worker limit leaves them a worker when every ordinary slot is busy.
    assert _railway_workers(tmp_path) == ["pool", "--max", "3", "2"]
    (tmp_path / "workers").unlink()
    assert _railway_workers(tmp_path, WORKER_PROCESSES="5") == ["pool", "--max", "5", "4"]


def test_railway_resident_worker_count_and_cap_are_overridable(tmp_path: Path) -> None:
    def resident(**env: str) -> list[str]:
        (tmp_path / "workers").unlink(missing_ok=True)
        return _railway_workers(tmp_path, WORKER_ON_DEMAND="false", **env)

    assert resident() == ["2", "2", "2"]
    assert resident(WORKER_PROCESSES="5") == ["4"] * 5
    assert resident(WORKER_PROCESSES="4", JOB_MAX_RUNNING_GLOBAL="0") == ["0"] * 4
    assert resident(WORKER_PROCESSES="1") == ["unset"]
