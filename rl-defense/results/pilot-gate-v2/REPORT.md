# Pilot gate v2: the deterministic long-block rule does not pass

_Measured against the owned demo app in the isolated in-process lab. Lab evidence only._

Pre-registration: [`PREREGISTRATION.md`](PREREGISTRATION.md), amendment 2, committed as
`5fe2d147` before the run. One run, 2026-11-14, four fresh frozen scenarios x 30 episodes,
every policy on the same episodes. Candidate: `always_block_principal_long` (not a learned
policy). Incumbent: the rules re-tuned on `train_v11`. Raw rows: [`episodes.json`](episodes.json);
[`summary.json`](summary.json); [`EVIDENCE.json`](EVIDENCE.json).

**Verdict: FAIL (4 of 9 checks pass). The scenarios are now exposed.**

| Check | Value | Required | Result |
|---|---|---|---|
| Paired return gain over the rules, 95% CI low | -0.921 | > 0 | **fail** |
| Compromise rate | 0.084 (rules 0.264) | <= rules | pass |
| Availability | 0.831 | >= 0.85 | **fail** |
| Delegated success | 0.711 | >= 0.85 | **fail** |
| False disruption | 0.136 | <= 0.25 | pass |
| Attack-free defense duty | 0.405 | <= 0.5 | pass |
| Return | -6.84 (rules -6.67) | > rules | **fail** |
| Worst per-scenario return difference against the rules | -4.311 | >= 0 | **fail** |

Pooled, same 120 episodes:

| Policy | Return | Compromise | Availability | Delegated success | False disruption |
|---|---|---|---|---|---|
| always_block_principal_long (candidate) | -6.84 | 0.084 | 0.831 | 0.711 | 0.136 |
| always_block_principal | -6.47 | 0.186 | 0.900 | 0.832 | 0.056 |
| frozen v6 (reference) | -6.53 | 0.172 | 0.892 | 0.824 | 0.080 |
| threshold_rules (incumbent) | -6.67 | 0.264 | 0.958 | 0.950 | 0.026 |
| always_block_top_principal_long | -7.17 | 0.136 | 0.836 | 0.711 | 0.133 |
| noop | -15.37 | 1.000 | 1.000 | 1.000 | 0.000 |

Per scenario (return / compromise / availability / delegated success):

| Scenario | long block | rules | frozen v6 |
|---|---|---|---|
| gate2_both_bookkeepers_rogue | -19.26 / 0.200 / 0.579 / 0.282 | -14.95 / 0.889 / 0.926 / 0.875 | -17.06 / 0.517 / 0.745 / 0.563 |
| gate2_busy_day_faint_insider | -2.41 / 0.200 / 0.971 / 1.000 | -6.17 / 1.000 / 1.000 / 1.000 | -3.21 / 0.395 / 0.981 / 1.000 |
| gate2_outsider_from_start | -0.10 / 0.000 / 1.000 / 1.000 | -0.15 / 0.001 / 1.000 / 1.000 | -0.12 / 0.000 / 1.000 / 1.000 |
| gate2_switching_quartet | -5.60 / 0.118 / 0.876 / 1.000 | -5.43 / 0.136 / 0.891 / 1.000 | -5.72 / 0.169 / 0.891 / 1.000 |

## Reading

- The rule's lead on validation and on the first gate's exposed episodes did not hold on
  unseen scenarios. That is what the fresh gate is for.
- One scenario decides it. When the attackers are themselves bookkeepers with real grants,
  a principal-wide block stops their attack and their authorized work together: delegated
  success falls to 28% and availability to 58%. The rules keep traffic flowing there and let
  89% of the attack through. No policy in the table does both.
- This is a limit of the control, not of the policy choosing it. The only containment
  available against a principal is to block all of that principal's requests. Against an
  insider who also has legitimate cross-tenant access, every policy must choose between the
  attack and the legitimate work. The v10 diagnosis reached the same mechanism.
- Frozen v6, run for reference only, would also fail here (it trails the rules on two
  scenarios and its delegated success is 0.824).
- Outside the insider-delegate case the long block is the best or near-best defender in
  three of four scenarios.

## What would change the result

A narrower control: refuse only the requests that no grant covers, per principal and
resource owner, instead of every request from the principal. The detector already makes
that distinction (it honours the delegation grant table), so the information exists; the
gateway and the action space do not expose a control that uses it. That is a product change
to the control surface, not a training change, and it should come before another candidate
or another gate.

## Consequences

- No pilot control is validated. RL readiness is unchanged (`rl-readiness` still reports the
  first gate's failure for v6). Nothing is promoted or enabled.
- `pilot_gate` and `pilot_gate_v2` are both exposed. Another gate needs new scenarios.
