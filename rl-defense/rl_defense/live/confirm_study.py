"""What holding ungranted readers for owner confirmation changes (diagnostic, not a gate).

    python -m rl_defense.live.confirm_study --out results/confirm-hold

Runs fixed policies on the gate v3 scenarios (two with a grant missing from the operator's
table) under the grant-scoped block and under the "confirm" scope at several owner-response
settings. Those scenarios were exposed by gate v3, so nothing here is held-out evidence.
The owner's answer is simulated: an owner who answers is always right.
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

SCENARIO_DIR = "pilot_gate_v3"
RULES_TUNING = pg.ROOT / "results" / "live-retrain-v11" / "rules_tuning.json"
# name -> loop overrides. Delay is in windows; response_p is the chance an owner answers.
SETTINGS: dict[str, dict[str, Any]] = {
    "ungranted": {"block_scope": "ungranted"},
    "confirm_delay2": {"block_scope": "confirm", "confirm_delay": 2},
    "confirm_delay8": {"block_scope": "confirm", "confirm_delay": 8},
    "confirm_delay2_half_answer": {
        "block_scope": "confirm",
        "confirm_delay": 2,
        "confirm_response_p": 0.5,
    },
}


def _summary(rows: list[ev.EpisodeMetrics], access: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        **ev.summarize(rows),
        **pg.access_summary(access),
        "confirmations_per_episode": pg.confirmations(access),
    }


def run(out: Path, episodes: int | None = None) -> dict[str, Any]:
    out.mkdir(parents=True, exist_ok=True)
    agent, _ = load_checkpoint(pg._pinned(pg.CANDIDATE, pg.CANDIDATE_SHA256))
    policies: dict[str, ev.PolicyFn] = {
        "always_block_principal_long": pg.FIXED_RULES["always_block_principal_long"],
        "threshold_rules": ev.rules_policy(json.loads(RULES_TUNING.read_text())["selected"]),
        "frozen_v6": ev.dqn_policy(agent),
    }
    scenarios = load_scenarios("holdout", subdir=SCENARIO_DIR)
    result: dict[str, Any] = {
        "caveat": ev.CAVEAT,
        "kind": "diagnostic on already-exposed gate v3 scenarios; not a gate",
        "owner_answers": "simulated: an owner who answers is always right",
        "git_sha": git_sha(),
        "scenario_dir": SCENARIO_DIR,
        "settings": SETTINGS,
        "results": {},
    }
    for setting, overrides in SETTINGS.items():
        for name, policy in policies.items():
            rows, access, _ = pg.run_policy(
                policy, scenarios, episodes=episodes, loop_overrides=overrides
            )
            entry = {
                "pooled": _summary(rows, access),
                "by_scenario": {
                    sc.name: _summary(
                        [r for r in rows if r.scenario == sc.name],
                        [a for a in access if a["scenario"] == sc.name],
                    )
                    for sc in scenarios
                },
            }
            result["results"].setdefault(name, {})[setting] = entry
            p = entry["pooled"]
            print(
                f"{setting:27s} {name:28s} ret {p['reward']:.2f} comp {p['compromise_rate']:.3f} "
                f"avail {p['availability']:.3f} deleg {p['delegated_success']:.3f} "
                f"duty {p['no_attack_defense_duty']:.3f}",
                flush=True,
            )
    (out / "confirm_study.json").write_text(json.dumps(result, indent=1, sort_keys=True))
    return result


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--episodes", type=int)
    args = ap.parse_args()
    run(args.out, args.episodes)


if __name__ == "__main__":
    main()
