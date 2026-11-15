"""Gate v3: fresh scenarios with an incomplete grant table, and the plumbing that measures
it. No gate scenario is run here; behaviour is exercised on a scenario built in the test."""

import json

import pytest

from rl_defense.live import evaluate as ev
from rl_defense.live import pilot_gate as pg
from rl_defense.live.adversary import IDENTITIES, delegation_grants
from rl_defense.live.scenarios import CONFIG_DIR, LiveScenario, load_scenarios

V3 = "pilot_gate_v3"


def _split(name: str) -> str:
    return "train" if name.startswith("train") else "val" if name.startswith("val") else "holdout"


def _scenario(**kw) -> LiveScenario:
    base = dict(
        name="t_missing_grant", split="train", horizon=12, schedule="always", start_active=True,
        attack_per_step=3, benign_per_step=5, attackers=("mallory",), victims=("bob",),
        benign=("alice", "bob", "carol", "dave", "erin"),
        delegations=("dave:alice", "erin:carol"), missing_grants=("erin:carol",),
        delegate_per_step=2, seed_start=7000, episodes=1,
    )  # fmt: skip
    return LiveScenario(**{**base, **kw})


def test_gate_v3_scenarios_are_fresh_and_two_have_an_incomplete_grant_table():
    gate = load_scenarios("holdout", subdir=V3)
    assert len(gate) == 4 and all(s.episodes == 30 and s.horizon == 30 for s in gate)
    names, seeds = set(), set()
    for d in sorted(p for p in CONFIG_DIR.iterdir() if p.is_dir() and p.name != V3):
        for s in load_scenarios(_split(d.name), subdir=d.name):
            names.add(s.name)
            seeds.update(s.seeds())
            assert not s.missing_grants  # no earlier scenario has the new case
    for s in gate:
        assert s.name not in names and not seeds & set(s.seeds())
    assert len({x for s in gate for x in s.seeds()}) == 120
    assert sorted(s.name for s in gate if s.missing_grants) == [
        "gate3_empty_grant_table",
        "gate3_stale_grant_bookkeeper",
    ]


def test_a_missing_grant_is_left_out_of_the_grant_table_only():
    sc = _scenario()
    dave, erin = (IDENTITIES[n].customer_id for n in ("dave", "erin"))
    assert delegation_grants(sc.driver().delegates) == {
        dave: frozenset({IDENTITIES["alice"].customer_id})
    }
    assert erin in {d.actor for d in sc.driver().delegates}  # erin still sends the traffic
    assert sc.config_hash() != _scenario(missing_grants=()).config_hash()
    with pytest.raises(ValueError, match="missing_grants not in delegations"):
        _scenario(missing_grants=("erin:alice",))


def test_earlier_scenario_hashes_are_unchanged_by_the_new_field():
    recorded = json.loads((pg.ROOT / "results/pilot-gate-v2/summary.json").read_text())
    now = {s.name: s.config_hash() for s in load_scenarios("holdout", subdir="pilot_gate_v2")}
    assert now == recorded["scenarios"]


def test_scoped_block_refuses_the_unlisted_delegate_and_nothing_else_legitimate():
    sc = [_scenario()]
    scoped = {"block_scope": "ungranted"}
    _, quiet, _ = pg.run_policy(ev.noop_policy, sc, loop_overrides=scoped)
    _, blocked, _ = pg.run_policy(ev.always_block_principal_long, sc, loop_overrides=scoped)
    assert quiet[0]["unlisted_delegated_requests"] > 0
    q, b = pg.access_summary(quiet), pg.access_summary(blocked)
    assert q["unlisted_delegated_success"] == 1.0  # nothing blocks under noop
    # erin's legitimate reads look ungranted: she is flagged, blocked, and refused on them
    assert b["unlisted_delegated_success"] < 0.5
    # dave's listed grant and everyone's own reads are untouched by the scoped block
    assert b["listed_delegated_success"] == 1.0 and b["own_traffic_success"] == 1.0
    assert b["delegated_success"] < 1.0


def test_gate_runs_incumbent_under_the_same_scope_and_reports_the_principal_scope(
    tmp_path, monkeypatch
):
    # plumbing only, on the scenario built above: never a gate scenario
    monkeypatch.setattr(pg, "load_scenarios", lambda *a, **k: [_scenario(horizon=6)])
    result = pg.run(
        tmp_path,
        candidate_rule="always_block_principal_long",
        rules_tuning=pg.ROOT / "results/live-retrain-v11/rules_tuning.json",
        rules_tuning_sha256="cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd",
        block_scope="ungranted",
    )
    assert result["loop_overrides"]["block_scope"] == "ungranted"
    assert result["missing_grants"] == {"t_missing_grant": ["erin:carol"]}
    assert {"candidate@principal", "threshold_rules@principal"} <= set(result["summary"])
    scoped = result["summary"]["candidate"]["pooled"]
    wide = result["summary"]["candidate@principal"]["pooled"]
    assert scoped["own_traffic_success"] == 1.0 > wide["own_traffic_success"]
    assert json.loads((tmp_path / "EVIDENCE.json").read_text())["block_scope"] == "ungranted"
