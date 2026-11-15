# Grant-scoped block: what it changes

_Measured against the owned demo app in the isolated in-process lab. Diagnostic on the
validation scenarios and on two gate scenario sets that were already exposed. Not a gate._

`DefenseControls.block_scope = "ungranted"` (`LoopConfig.block_scope`, off by default): a
blocked principal is refused only on requests for another owner's object that no delegation
grant covers. Their own reads and authorized delegated reads pass. Command:
`python -m rl_defense.live.scope_study --out results/grant-scoped-block`; raw numbers in
[`scope_study.json`](scope_study.json). Same episodes and same policies under both scopes.

| Set | Policy | Return: principal → ungranted | Compromise (both) | Availability | Delegated success |
|---|---|---|---|---|---|
| val_v11 | always_block_principal_long | -5.75 → -1.58 | 0.107 | 0.873 → 1.000 | 0.819 → 1.000 |
| val_v11 | frozen v6 | -7.13 → -3.30 | 0.244 | 0.883 → 1.000 | 0.824 → 1.000 |
| val_v11 | threshold_rules | -8.37 → -5.72 | 0.336 | 0.923 → 1.000 | 0.909 → 1.000 |
| pilot_gate | always_block_principal_long | -4.90 → -0.97 | 0.066 | 0.899 → 1.000 | 0.869 → 1.000 |
| pilot_gate | frozen v6 | -5.08 → -1.24 | 0.090 | 0.901 → 1.000 | 0.873 → 1.000 |
| pilot_gate | threshold_rules | -5.57 → -2.93 | 0.198 | 0.940 → 1.000 | 0.944 → 1.000 |
| pilot_gate_v2 | always_block_principal_long | -6.84 → -1.41 | 0.084 | 0.831 → 1.000 | 0.711 → 1.000 |
| pilot_gate_v2 | frozen v6 | -6.53 → -2.94 | 0.172 | 0.892 → 1.000 | 0.824 → 1.000 |
| pilot_gate_v2 | threshold_rules | -6.67 → -5.04 | 0.264 | 0.958 → 1.000 | 0.950 → 1.000 |

## Reading

- The trade-off the gates found is gone. Under the scoped block no policy blocks a single
  legitimate or delegated request on any of the 288 episodes, and each policy's compromise
  rate is unchanged, because it blocks the same attack requests as before.
- On the scenario that sank the long-block rule in gate v2 (both bookkeepers rogue), the
  rule goes from 4.31 below the rules to 9.27 above them. With the scoped block it is ahead
  of the rules on every scenario of both exposed sets.
- The remaining compromise (6% to 11% for the long block) is the attack traffic that gets
  through before a principal is first flagged and after a block lapses.

## What this does not show

- **It is not a gate pass.** Both gate sets were exposed before this control existed.
- **The lab's grant table is exactly right.** The scoped block refuses what no grant covers,
  so with a perfect table it cannot refuse authorized work by construction. In a real
  application the result depends on how complete and current the grant data is: a missing
  or stale grant becomes a blocked legitimate request. None of these scenarios test that.
- **It removes the decision, not just the cost.** Once blocking costs legitimate users
  nothing, the best policy is to block every flagged principal for as long as possible, which
  is the fixed rule. There is nothing left here for a learned policy to add, and the honest
  description of the control is "enforce the ownership check for flagged principals", which is
  close to fixing the planted authorization bug at the gateway.

## Next step, if a pilot control is still wanted

A new pre-registered gate with fresh scenarios, the long-block rule under the scoped block as
the candidate, and scenarios that include an incomplete grant table (a legitimate delegate
whose grant is missing). Without that case the gate would be passed by construction.
