"""Gate v4: fresh scenarios for the confirm scope, and owners who can be wrong. No gate
scenario is run here; behaviour is exercised on a scenario built in the test."""

import json

import pytest

from rl_defense.live import evaluate as ev
from rl_defense.live import pilot_gate as pg
from rl_defense.live.scenarios import CONFIG_DIR, LiveScenario, load_scenarios

V4 = "pilot_gate_v4"
LONG = ev.always_block_principal_long


def _split(name: str) -> str:
    return "train" if name.startswith("train") else "val" if name.startswith("val") else "holdout"


def _scenario(**kw) -> LiveScenario:
    base = dict(
        name="t_owner_error", split="train", horizon=14, schedule="always", start_active=True,
        attack_per_step=3, benign_per_step=5, attackers=("mallory",), victims=("bob",),
        benign=("alice", "bob", "carol", "dave", "erin"),
        delegations=("dave:alice", "erin:carol"), missing_grants=("erin:carol",),
        delegate_per_step=2, seed_start=7200, episodes=2,
    )  # fmt: skip
    return LiveScenario(**{**base, **kw})


def _run(**overrides):  # noqa: ANN202
    rows, access, _ = pg.run_policy(
        LONG, [_scenario()], loop_overrides={"block_scope": "confirm", **overrides}
    )
    return ev.summarize(rows), pg.access_summary(access), pg.confirmations(access)


def test_gate_v4_scenarios_are_fresh():
    gate = load_scenarios("holdout", subdir=V4)
    assert len(gate) == 4 and all(s.episodes == 30 and s.horizon == 30 for s in gate)
    names, seeds = set(), set()
    for d in sorted(p for p in CONFIG_DIR.iterdir() if p.is_dir() and p.name != V4):
        for s in load_scenarios(_split(d.name), subdir=d.name):
            names.add(s.name)
            seeds.update(s.seeds())
    for s in gate:
        assert s.name not in names and not seeds & set(s.seeds())
    assert len({x for s in gate for x in s.seeds()}) == 120
    assert sum(bool(s.missing_grants) for s in gate) == 2


def test_an_owner_who_is_always_wrong_lets_the_attacker_in_and_keeps_the_delegate_out():
    right, right_access, right_counts = _run(confirm_delay=1)
    wrong, wrong_access, wrong_counts = _run(confirm_delay=1, confirm_error_p=1.0)
    assert right_counts["wrongly_confirmed"] == right_counts["wrongly_denied"] == 0
    # the attacker's pair is confirmed: his reads are no longer flagged or refused
    assert wrong_counts["wrongly_confirmed"] >= 1 and wrong_counts["wrongly_denied"] == 1
    assert wrong["compromise_rate"] > right["compromise_rate"] + 0.3
    # the legitimate delegate is denied and stays held
    assert wrong_access["unlisted_delegated_success"] < 0.2
    assert right_access["unlisted_delegated_success"] > 0.7


def test_gate_run_records_the_confirmation_settings(tmp_path, monkeypatch):
    # plumbing only, on the scenario built above: never a gate scenario
    monkeypatch.setattr(pg, "load_scenarios", lambda *a, **k: [_scenario(horizon=6)])
    kw = dict(
        candidate_rule="always_block_principal_long",
        rules_tuning=pg.ROOT / "results/live-retrain-v11/rules_tuning.json",
        rules_tuning_sha256="cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd",
    )
    settings = {"confirm_delay": 1, "confirm_response_p": 0.5, "confirm_error_p": 0.25}
    result = pg.run(tmp_path, block_scope="confirm", confirm=settings, **kw)
    assert result["loop_overrides"] == {
        **ev.V4_LOOP_OVERRIDES,
        "block_scope": "confirm",
        **settings,
    }
    assert json.loads((tmp_path / "EVIDENCE.json").read_text())["confirm"] == settings
    pooled = result["summary"]["candidate"]["pooled"]
    assert pooled["confirmations_per_episode"]["requested"] > 0
    assert (
        result["summary"]["candidate@principal"]["pooled"]["confirmations_per_episode"]["requested"]
        == 0
    )
    with pytest.raises(ValueError, match="need block_scope='confirm'"):
        pg.run(tmp_path, block_scope="ungranted", confirm=settings, **kw)
