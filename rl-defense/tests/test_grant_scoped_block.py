"""The grant-scoped block: a blocked principal loses only the requests no grant covers."""

import pytest

from rl_defense.live import evaluate as ev
from rl_defense.live import pilot_gate as pg
from rl_defense.live.adversary import IDENTITIES, live_app
from rl_defense.live.contracts import DefenseControls
from rl_defense.live.gateway import DefensiveGateway
from rl_defense.live.scenarios import load_scenarios
from rl_defense.live.topology import load_topology

DAVE, TOKEN = IDENTITIES["dave"].customer_id, IDENTITIES["dave"].tokens[0]
GRANTS = {DAVE: {IDENTITIES["alice"].customer_id}}  # dave is alice's bookkeeper
OWN, DELEGATED, UNGRANTED = "/payments/pay_d1", "/payments/pay_a1", "/payments/pay_c1"


def _gateway(controls: DefenseControls, grants=GRANTS) -> DefensiveGateway:
    return DefensiveGateway(live_app(), load_topology(), controls, grants=grants)


def _get(gw: DefensiveGateway, path: str):
    return gw.request("GET", path, actor=DAVE, token=TOKEN)


def test_without_a_block_the_ungranted_read_is_a_real_compromise():
    with _gateway(DefenseControls()) as gw:
        rec = _get(gw, UNGRANTED)
        assert rec.status == 200 and rec.compromised and rec.cross_tenant_attempt
        delegated = _get(gw, DELEGATED)
        assert delegated.status == 200 and not delegated.cross_tenant_attempt


def test_principal_scope_refuses_everything_from_the_blocked_principal():
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]})
    assert controls.block_scope == "principal"  # the default is the v2-v10 behaviour
    with _gateway(controls) as gw:
        for path in (OWN, DELEGATED, UNGRANTED):
            rec = _get(gw, path)
            assert (rec.status, rec.blocked_reason) == (403, "principal_blocked")


def test_ungranted_scope_refuses_only_what_no_grant_covers():
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="ungranted")
    with _gateway(controls) as gw:
        assert _get(gw, OWN).status == 200 and _get(gw, OWN).allowed
        delegated = _get(gw, DELEGATED)
        assert delegated.status == 200 and delegated.allowed
        attack = _get(gw, UNGRANTED)
        assert (attack.status, attack.blocked_reason) == (403, "ungranted_blocked")
        assert not attack.compromised and attack.cross_tenant_attempt
        # an unblocked principal is untouched
        other = gw.request(
            "GET", "/payments/pay_a1", actor="x", token=IDENTITIES["alice"].tokens[0]
        )
        assert other.status == 200


def test_without_the_grant_table_a_delegated_read_counts_as_ungranted():
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="ungranted")
    with _gateway(controls, grants=None) as gw:
        assert _get(gw, OWN).status == 200
        assert _get(gw, DELEGATED).blocked_reason == "ungranted_blocked"


def test_unknown_scope_is_rejected():
    with pytest.raises(ValueError):
        DefenseControls(block_scope="everything")


def test_in_the_loop_the_scoped_block_keeps_authorized_traffic_on_an_insider_scenario():
    sc = [s for s in load_scenarios("train", subdir="train_v11") if "insider_delegate" in s.name]
    policy = pg.FIXED_RULES["always_block_principal_long"]
    wide_rows, wide_access, _ = pg.run_policy(policy, sc, episodes=3)
    rows, access, _ = pg.run_policy(
        policy, sc, episodes=3, loop_overrides={"block_scope": "ungranted"}
    )
    wide, scoped = ev.summarize(wide_rows), ev.summarize(rows)
    assert pg.access_summary(access)["delegated_success"] == 1.0
    assert pg.access_summary(wide_access)["delegated_success"] < 1.0
    assert scoped["availability"] == 1.0 and wide["availability"] < 1.0
    assert scoped["compromise_rate"] <= wide["compromise_rate"] + 1e-9


@pytest.mark.parametrize(
    "path",
    [
        "/payments/./pay_c1",
        "/payments/unused/../pay_c1",
        "//payments//pay_c1",
        "/payments/%2E/pay_c1",
    ],
)
def test_dot_segments_and_repeated_slashes_resolve_before_the_ownership_lookup(path):
    from rl_defense.live.gateway import _route

    assert _route(path) == UNGRANTED
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="ungranted")
    with _gateway(controls) as gw:
        rec = _get(gw, path)
        assert rec.blocked_reason == "ungranted_blocked" and not rec.compromised


def test_route_normalization_keeps_ordinary_paths():
    from rl_defense.live.gateway import _route

    for p in ("/", "/me", "/payments", "/payments/pay_a1", "/customers/cus_alice"):
        assert _route(p) == p


@pytest.mark.parametrize("suffix", ["?x=1", "/", "#frag", "?a=b&c=d"])
def test_a_decorated_path_cannot_slip_past_the_detector_or_the_scoped_block(suffix):
    path = UNGRANTED + suffix
    with _gateway(DefenseControls()) as gw:
        seen = _get(gw, path)
        assert seen.cross_tenant_attempt and seen.owner == IDENTITIES["carol"].customer_id
        assert seen.node == "payments" and DAVE in gw.flagged_principals()
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="ungranted")
    with _gateway(controls) as gw:
        assert _get(gw, path).blocked_reason == "ungranted_blocked"
        assert _get(gw, OWN + suffix).allowed  # own reads still pass, decorated or not


def test_percent_encoded_ids_resolve_to_the_same_owner():
    controls = DefenseControls(blocked_principals={DAVE: ["payments"]}, block_scope="ungranted")
    with _gateway(controls) as gw:
        assert _get(gw, "/payments/pay%5Fc1").blocked_reason == "ungranted_blocked"
