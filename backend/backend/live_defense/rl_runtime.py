from __future__ import annotations

import json
import os
from datetime import timedelta
from pathlib import Path

import sqlalchemy as sa
from pydantic import ValidationError

from backend.db import live_policy_decisions
from backend.live_defense.policy import REPO_ROOT
from shared.base import utcnow
from shared.live_defense import InferenceStatus, RlDecisionActivity, RlSmokeSummary

SMOKE_SUMMARY_ENV = "RL_LIVE_SMOKE_SUMMARY_PATH"
DEFAULT_SMOKE_SUMMARY = REPO_ROOT / "rl-defense" / "runs" / "live-smoke" / "summary.json"
WINDOW = timedelta(hours=24)


def smoke_summary_path() -> Path:
    configured = os.environ.get(SMOKE_SUMMARY_ENV)
    return Path(configured) if configured else DEFAULT_SMOKE_SUMMARY


def decision_activity(conn: sa.Connection, project_id: str) -> RlDecisionActivity:
    t = live_policy_decisions
    status = t.c.doc["inference_status"].astext
    last = conn.execute(
        sa.select(t.c.created_at, status)
        .where(t.c.project_id == project_id)
        .order_by(t.c.created_at.desc(), t.c.id.desc())
        .limit(1)
    ).first()
    counts = conn.execute(
        sa.select(status, sa.func.count())
        .where(t.c.project_id == project_id, t.c.created_at >= utcnow() - WINDOW)
        .group_by(status)
    ).all()
    ran = sum(n for s, n in counts if s == InferenceStatus.ran.value)
    abstained = sum(n for s, n in counts if s != InferenceStatus.ran.value)
    reason = None
    if last is None:
        reason = "no live policy decision has been recorded for this project"
    elif not counts:
        reason = "no live policy decision in the last 24 hours"
    created_at = last[0] if last is not None else None
    if created_at is not None and created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=utcnow().tzinfo)
    return RlDecisionActivity(
        last_decision_at=created_at,
        last_decision_status=last[1] if last is not None else None,
        recommendations=ran,
        abstentions=abstained,
        reason=reason,
    )


def smoke_summary() -> RlSmokeSummary:
    path = smoke_summary_path()
    shown = str(path.relative_to(REPO_ROOT)) if path.is_relative_to(REPO_ROOT) else str(path)
    if not path.is_file():
        return RlSmokeSummary(
            available=False,
            source_path=shown,
            reason="no live-loop smoke summary is stored on this backend host",
        )
    try:
        doc = json.loads(path.read_text())
        if not isinstance(doc, dict) or doc.get("kind") != "rl_live_smoke":
            raise ValueError("file is not an rl_live_smoke summary")
        return RlSmokeSummary(
            available=True,
            source_path=shown,
            passed=bool(doc["passed"]),
            finished_at=doc["finished_at"],
            episodes=doc["episodes"],
            steps=doc["steps"],
            transitions_written=doc["transitions_written"],
            compromise_rate=doc["compromise_rate"],
            availability=doc["availability"],
            checkpoint_sha256=doc["checkpoint_sha256"],
            device=doc.get("device"),
        )
    except (OSError, ValueError, KeyError, TypeError, ValidationError) as exc:
        return RlSmokeSummary(
            available=False,
            source_path=shown,
            reason=f"stored smoke summary is unreadable: {type(exc).__name__}: {exc}"[:400],
        )
