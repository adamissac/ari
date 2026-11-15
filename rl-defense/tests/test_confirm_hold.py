"""The "confirm" block scope: an ungranted reader is held, the owner is asked once, and a
confirmed pair is let through. The owner's answer is simulated from the real delegations."""

from rl_defense.live import evaluate as ev
from rl_defense.live import pilot_gate as pg
from rl_defense.live.adversary import IDENTITIES, live_app
from rl_defense.live.contracts import DefenseControls
from rl_defense.live.gateway import DefensiveGateway
from rl_defense.live.scenarios import LiveScenario
from rl_defense.live.topology import load_topology

DAVE, TOKEN = IDENTITIES["dave"].customer_id, IDENTITIES["dave"].tokens[0]
ALICE, CAROL = (IDENTITIES[n].customer_id for n in ("alice", "carol"))
OWN, ALICES, CAROLS = "/payments/pay_d1", "/payments/pay_a1", "/payments/pay_c1"
LONG = ev.always_block_principal_long


def _scenario(**kw) -> LiveScenario:
    base = dict(
        name="t_confirm", split="train", horizon=14, schedule="always", start_active=True,
        attack_per_step=3, benign_per_step=5, attackers=("mallory",), victims=("bob",),
        benign=("alice", "bob", "carol", "dave", "erin"),
        delegations=("dave:alice", "erin:carol"), missing_grants=("erin:carol",),
        delegate_per_step=2, seed_start=7100, episodes=2,
    )  # fmt: skip
    return LiveScenario(**{**base, **kw})


def _run(policy=LONG, **overrides):  # noqa: ANN001, ANN202
    rows, access, _ = pg.run_policy(policy, [_scenario()], loop_overrides=overrides)
    return ev.summarize(rows), pg.access_summary(access), access


def test_gateway_holds_the_ungranted_read_until_the_owner_confirms_that_pair_only():
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="confirm")
    with DefensiveGateway(live_app(), load_topology(), controls, grants={}) as gw:
        get = lambda path: gw.request("GET", path, actor=DAVE, token=TOKEN)  # noqa: E731
        assert get(OWN).status == 200  # own reads are never held
        held = get(ALICES)
        assert (held.status, held.blocked_reason) == (403, "held_for_confirmation")
        assert held.cross_tenant_attempt and not held.compromised
        gw.confirm(DAVE, ALICE)
        ok = get(ALICES)
        assert ok.status == 200 and not ok.cross_tenant_attempt
        assert get(CAROLS).blocked_reason == "held_for_confirmation"  # another owner: still held
        assert gw.flagged_principals() == {DAVE: {"payments"}}


def test_confirmation_restores_the_unlisted_delegate_and_never_the_attacker():
    scoped, scoped_access, _ = _run(block_scope="ungranted")
    held, held_access, rows = _run(block_scope="confirm", confirm_delay=2)
    assert scoped_access["unlisted_delegated_success"] < 0.5  # gate v3's failure
    assert held_access["unlisted_delegated_success"] > 0.7  # held a few windows, then let through
    assert held_access["unlisted_delegated_success"] < 1.0  # the hold itself costs something
    assert held["compromise_rate"] == scoped["compromise_rate"]  # the attacker gains nothing
    assert held["reward"] > scoped["reward"]
    for a in rows:  # per episode: erin's pair confirmed, mallory's pair(s) denied
        assert a["confirmations_confirmed"] == 1 and a["confirmations_denied"] >= 1
        assert (
            a["confirmations_requested"] == a["confirmations_confirmed"] + a["confirmations_denied"]
        )


def test_an_owner_who_never_answers_leaves_the_pair_held():
    _, silent, rows = _run(block_scope="confirm", confirm_response_p=0.0)
    _, scoped, _ = _run(block_scope="ungranted")
    assert silent["unlisted_delegated_success"] == scoped["unlisted_delegated_success"]
    assert all(a["confirmations_confirmed"] == a["confirmations_denied"] == 0 for a in rows)
    assert all(a["confirmations_unanswered"] == a["confirmations_requested"] > 0 for a in rows)


def test_a_longer_delay_costs_more_and_other_scopes_ask_nobody():
    _, fast, _ = _run(block_scope="confirm", confirm_delay=1)
    _, slow, _ = _run(block_scope="confirm", confirm_delay=8)
    assert slow["unlisted_delegated_success"] < fast["unlisted_delegated_success"]
    for scope in ("principal", "ungranted"):
        _, _, rows = _run(block_scope=scope)
        assert all(a["confirmations_requested"] == 0 for a in rows)


def test_confirm_scope_does_not_change_the_traffic():
    a = pg.run_policy(ev.noop_policy, [_scenario()], loop_overrides={"block_scope": "confirm"})
    b = pg.run_policy(ev.noop_policy, [_scenario()])
    assert a[0] == b[0]  # nothing is blocked under noop, so nothing is held or asked
