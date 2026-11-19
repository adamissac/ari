from __future__ import annotations

import hashlib
import shutil
import sys
from datetime import timedelta

import httpx
import pytest

from backend.live_defense import owned_test_app, policy
from shared.base import utcnow

pytestmark = [pytest.mark.live_defense_e2e, pytest.mark.live_defense_smoke]

PIN = policy.V6_SHA256
ROUTE = "GET /payments/{payment_id}"
OWNER = "prn_owner0001"
OTHER = "prn_other0001"


@pytest.fixture
def owned_fixture():
    port, stop = owned_test_app.serve_in_thread(owned_test_app.create_app())
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        stop()


@pytest.fixture
def fresh_runner(monkeypatch):
    monkeypatch.setattr(policy, "_RUNNER", None)


def _measured_window(base_url: str, end, *, route: str = ROUTE) -> dict:
    statuses: list[int] = []
    principals = {OWNER: {"own": 0, "cross_tenant": 0}, OTHER: {"own": 0, "cross_tenant": 0}}
    with httpx.Client(base_url=base_url, timeout=5) as http:
        for i in range(20):
            who = OWNER if i % 2 == 0 else OTHER
            resp = http.get(owned_test_app.FIXTURE_ROUTE)
            statuses.append(resp.status_code)
            if resp.status_code == 200:
                principals[who]["own" if who == OWNER else "cross_tenant"] += 1
    return {
        "source": "owned_staging",
        "window_start": (end - timedelta(minutes=1)).isoformat(),
        "window_end": end.isoformat(),
        "routes": [
            {
                "route": route,
                "requests": len(statuses),
                "status_4xx": sum(1 for s in statuses if 400 <= s < 500),
                "status_5xx": sum(1 for s in statuses if s >= 500),
                "auth_failures": sum(1 for s in statuses if s in (401, 403)),
                "principals": [
                    {"principal": p, **counts}
                    for p, counts in principals.items()
                    if counts["own"] or counts["cross_tenant"]
                ],
            }
        ],
    }


def _setup(staging):
    alice, bob = staging.login("alice"), staging.login("bob")
    app = staging.create_project(alice, bob, approve_scope=True)
    staging.register_app(app)
    staging.issue_token(app)
    return alice, app


def _ingest_and_decide(staging, alice, app, batch) -> list[dict]:
    resp = staging.ingest(alice, app, batch)
    assert resp.status_code == 202, resp.text
    staging.drain()
    page = alice.get(f"/api/v1/projects/{app.project_id}/live-policy-decisions")
    assert page.status_code == 200, page.text
    return page.json()["items"]


def _assert_truthful(decision: dict) -> None:
    assert decision["executed"] is False
    assert decision["enforcement"] == "NOT_EXECUTED"
    if decision["inference_status"] == "ran":
        assert decision["checkpoint_sha256"] == PIN
        assert decision["feature_schema_ok"] is True
        assert decision["action_mask_valid"] is True
        assert decision["abstention_reason"] is None
    else:
        assert decision["checkpoint_sha256"] is None
        assert decision["abstention_reason"]


def test_fresh_owned_telemetry_yields_decision_or_explicit_abstention(
    staging, owned_fixture, fresh_runner, report
):
    alice, app = _setup(staging)
    items = _ingest_and_decide(staging, alice, app, _measured_window(owned_fixture, utcnow()))
    assert len(items) == 1
    decision = items[0]
    _assert_truthful(decision)
    report.check("fresh telemetry decision", "ran or abstained", decision["inference_status"])
    runtime = alice.get(f"/api/v1/projects/{app.project_id}/defense-health").json()
    assert runtime["rl_runtime"]["mode"] == "shadow, recommendation only"
    if runtime["rl_runtime"]["loaded"]:
        assert decision["inference_status"] == "ran"
        assert runtime["rl_runtime"]["label"] == "RL runtime: loaded"
        assert runtime["rl_runtime"]["checkpoint_sha256"] == PIN
    else:
        assert decision["inference_status"] == "skipped_unavailable"
        assert runtime["rl_runtime"]["label"] == "RL runtime: not loaded"
        assert runtime["rl_runtime"]["reason"]
    activity = runtime["rl_decisions"]
    assert activity["recommendations"] + activity["abstentions"] == 1
    assert activity["last_decision_at"] is not None
    detail = alice.get(f"/api/v1/live-policy-decisions/{decision['id']}")
    assert detail.status_code == 200 and detail.json()["id"] == decision["id"]


def test_stale_owned_telemetry_abstains_with_reason(staging, owned_fixture, fresh_runner, report):
    alice, app = _setup(staging)
    stale = utcnow() - timedelta(hours=2)
    items = _ingest_and_decide(staging, alice, app, _measured_window(owned_fixture, stale))
    assert len(items) == 1
    decision = items[0]
    _assert_truthful(decision)
    assert decision["inference_status"] == "skipped_stale"
    assert decision["freshness_ok"] is False
    report.check("stale telemetry abstains", "skipped_stale", decision["inference_status"])


def test_unmapped_route_abstains_with_reason(staging, owned_fixture, fresh_runner, report):
    alice, app = _setup(staging)
    batch = _measured_window(owned_fixture, utcnow(), route="GET /widgets/{widget_id}")
    items = _ingest_and_decide(staging, alice, app, batch)
    assert len(items) == 1
    decision = items[0]
    _assert_truthful(decision)
    assert decision["inference_status"] == "skipped_schema"
    assert "payments-lite topology" in decision["abstention_reason"]
    report.check("unmapped route abstains", "skipped_schema", decision["inference_status"])


def test_tampered_checkpoint_reports_not_loaded(staging, tmp_path, monkeypatch, fresh_runner):
    alice, app = _setup(staging)
    copy = tmp_path / "candidate_online.pt"
    shutil.copyfile(policy.V6_CHECKPOINT, copy)
    shutil.copyfile(
        policy.V6_CHECKPOINT.with_suffix(".manifest.json"), copy.with_suffix(".manifest.json")
    )
    blob = bytearray(copy.read_bytes())
    blob[len(blob) // 2] ^= 0xFF
    copy.write_bytes(bytes(blob))
    monkeypatch.setattr(policy, "V6_CHECKPOINT", copy)
    for path in ("defense-health", "rl-readiness"):
        runtime = alice.get(f"/api/v1/projects/{app.project_id}/{path}").json()["rl_runtime"]
        assert runtime["loaded"] is False
        assert runtime["label"] == "RL runtime: not loaded"
        assert "hash mismatch" in runtime["reason"]
        assert runtime["checkpoint_sha256"] != PIN
    monkeypatch.undo()
    original = (
        policy.REPO_ROOT / "rl-defense" / "results" / "live-retrain-v6" / "candidate_online.pt"
    )
    assert hashlib.sha256(original.read_bytes()).hexdigest() == PIN


def test_torch_unavailable_reports_not_loaded(staging, monkeypatch, fresh_runner):
    alice, app = _setup(staging)
    monkeypatch.setitem(sys.modules, "torch", None)
    for path in ("defense-health", "rl-readiness"):
        resp = alice.get(f"/api/v1/projects/{app.project_id}/{path}")
        assert resp.status_code == 200, resp.text
        runtime = resp.json()["rl_runtime"]
        assert runtime["loaded"] is False
        assert runtime["torch_available"] is False
        assert "torch is not importable" in runtime["reason"]
    readiness = alice.get(f"/api/v1/projects/{app.project_id}/rl-readiness").json()
    assert readiness["ready"] is False


def _status_paths_report_not_loaded(alice, app, needle: str) -> None:
    for path in ("defense-health", "rl-readiness"):
        resp = alice.get(f"/api/v1/projects/{app.project_id}/{path}")
        assert resp.status_code == 200, resp.text
        runtime = resp.json()["rl_runtime"]
        assert runtime["loaded"] is False
        assert runtime["label"] == "RL runtime: not loaded"
        assert needle in runtime["reason"]


def test_non_object_manifest_reports_not_loaded(staging, tmp_path, monkeypatch, fresh_runner):
    alice, app = _setup(staging)
    copy = tmp_path / "candidate_online.pt"
    shutil.copyfile(policy.V6_CHECKPOINT, copy)
    copy.with_suffix(".manifest.json").write_text("[]")
    monkeypatch.setattr(policy, "V6_CHECKPOINT", copy)
    _status_paths_report_not_loaded(alice, app, "manifest")


def test_unreadable_checkpoint_reports_not_loaded(staging, tmp_path, monkeypatch, fresh_runner):
    alice, app = _setup(staging)
    copy = tmp_path / "candidate_online.pt"
    shutil.copyfile(policy.V6_CHECKPOINT, copy)
    monkeypatch.setattr(policy, "V6_CHECKPOINT", copy)
    real = type(copy).read_bytes

    def denied(self):
        if self == copy:
            raise PermissionError(13, "Permission denied", str(self))
        return real(self)

    monkeypatch.setattr(type(copy), "read_bytes", denied)
    _status_paths_report_not_loaded(alice, app, "unreadable")


@pytest.mark.parametrize("body", ["[]", "42", "{not json"])
def test_malformed_smoke_summary_reports_not_available(staging, tmp_path, monkeypatch, body):
    alice, app = _setup(staging)
    summary = tmp_path / "summary.json"
    summary.write_text(body)
    monkeypatch.setenv("RL_LIVE_SMOKE_SUMMARY_PATH", str(summary))
    for path in ("defense-health", "rl-readiness"):
        resp = alice.get(f"/api/v1/projects/{app.project_id}/{path}")
        assert resp.status_code == 200, resp.text
        smoke = resp.json()["rl_smoke"]
        assert smoke["available"] is False
        assert "unreadable" in smoke["reason"]
