"""What the grant-scoped block changes, policy by policy (diagnostic, not a gate).

    python -m rl_defense.live.scope_study --out results/grant-scoped-block

Runs the same fixed policies under ``block_scope="principal"`` and ``"ungranted"`` on the
validation scenarios and on the two pilot-gate scenario sets. Both gate sets were already
exposed when this was written, so nothing here is held-out evidence: it shows whether the
narrower control removes the trade-off the gates found, and it is the basis for deciding
whether a new pre-registered gate is worth running.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from rl_defense.checkpoint import git_sha, load_checkpoint
from rl_defense.live import evaluate as ev
from rl_defense.live import pilot_gate as pg
from rl_defense.live.scenarios import load_scenarios

SETS: tuple[tuple[str, str], ...] = (
    ("val", "val_v11"),
    ("holdout", "pilot_gate"),
    ("holdout", "pilot_gate_v2"),
)
RULES_TUNING = pg.ROOT / "results" / "live-retrain-v11" / "rules_tuning.json"
SCOPES = ("principal", "ungranted")


def run(out: Path, episodes: int | None = None) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    agent, _ = load_checkpoint(pg._pinned(pg.CANDIDATE, pg.CANDIDATE_SHA256))
    rules = json.loads(RULES_TUNING.read_text())["selected"]
    policies: dict[str, ev.PolicyFn] = {
        "always_block_principal_long": pg.FIXED_RULES["always_block_principal_long"],
        "always_block_principal": pg.FIXED_RULES["always_block_principal"],
        "threshold_rules": ev.rules_policy(rules),
        "frozen_v6": ev.dqn_policy(agent),
    }
    result: dict[str, Any] = {
        "caveat": ev.CAVEAT,
        "kind": "diagnostic on validation and already-exposed gate scenarios; not a gate",
        "git_sha": git_sha(),
        "sets": {},
    }
    for split, subdir in SETS:
        scenarios = load_scenarios(split, subdir=subdir)  # type: ignore[arg-type]
        per_set: dict[str, Any] = {}
        for scope in SCOPES:
            for name, policy in policies.items():
                rows, access, _ = pg.run_policy(
                    policy, scenarios, episodes=episodes, loop_overrides={"block_scope": scope}
                )
                per_set.setdefault(name, {})[scope] = {
                    "pooled": {**ev.summarize(rows), **pg.access_summary(access)},
                    "by_scenario": {
                        sc: {
                            **s,
                            **pg.access_summary([a for a in access if a["scenario"] == sc]),
                        }
                        for sc, s in ev.summarize_by_scenario(rows).items()
                    },
                }
                p = per_set[name][scope]["pooled"]
                print(
                    f"{subdir} {scope:9s} {name:28s} ret {p['reward']:.2f} "
                    f"comp {p['compromise_rate']:.3f} avail {p['availability']:.3f} "
                    f"deleg {p['delegated_success']:.3f}",
                    flush=True,
                )
        result["sets"][subdir] = per_set
    (out / "scope_study.json").write_text(json.dumps(result, indent=1, sort_keys=True))
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--episodes", type=int)
    args = ap.parse_args()
    run(args.out, args.episodes)


if __name__ == "__main__":
    main()
