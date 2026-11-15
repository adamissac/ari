# Pilot gate v4: FAIL (8 of 9 checks pass)

_Measured against the owned demo app in the isolated in-process lab. Lab evidence only. The
candidate is a fixed rule, not a learned policy, and the owner is simulated; RL readiness is
unchanged._

Pre-registered in [`PREREGISTRATION.md`](PREREGISTRATION.md) (commit `298d05cf`, before the
run). Run once at that commit; raw numbers in [`summary.json`](summary.json) and
[`episodes.json`](episodes.json), hashes in [`EVIDENCE.json`](EVIDENCE.json). Candidate:
`always_block_principal_long` with the hold-for-owner-confirmation control. Incumbent: the
re-tuned threshold rules under the same control. Owner settings: answer after 4 windows,
75% answer, 10% of answers wrong. 4 scenarios x 30 episodes, two with missing grants.

## Checks

| Check | Candidate | Threshold | |
|---|---|---|---|
| Paired episodes match | 120 / 120 | identical | pass |
| Paired return gain over rules, CI low | +0.80 (mean +1.20) | > 0 | pass |
| Compromise rate | 0.100 | <= rules (0.170) | pass |
| Availability | 0.900 | >= 0.85 | pass |
| False disruption | 0.100 | <= 0.25 | pass |
| Attack-free windows with legitimate traffic blocked | 0.375 | <= 0.5 | pass |
| Beats the rules on return | -5.28 vs -6.48 | > rules | pass |
| Worst scenario against the rules | +0.02 | >= 0 | pass |
| Delegated success | 0.777 | >= 0.85 | **fail** |

## By scenario (candidate)

| Scenario | Grant table | Return (rules) | Compromise | Availability | Delegated: listed / unlisted | Wrongly confirmed attackers per episode |
|---|---|---|---|---|---|---|
| both_grants_missing | both missing | -11.40 (-13.52) | 0.169 | 0.751 | none / 0.515 | 0.30 |
| insider_beside_unlisted_delegate | one of two missing | -6.96 (-7.61) | 0.240 | 0.862 | 1.000 / 0.429 | 0.13 |
| outsider_five_victims | complete | -1.48 (-1.50) | 0.046 | 1.000 | 1.000 / none | 0.30 |
| quiet_day_rare_insider | complete | -1.30 (-3.30) | 0.384 | 1.000 | 1.000 / none | 0.03 |

## Reading

- **The one failed check is the one the control was built for.** Delegates whose grant is
  missing got 48% of their authorized reads through (0.000 under the scoped block in gate
  v3). That is not enough: with a 4-window wait, a quarter of owners silent and some wrong
  denials, pooled delegated success is 0.777 against a floor of 0.85.
- **Wrong confirmations cost security, as pre-registered to report.** Same rule, same
  episodes: compromise is 0.100 with the hold against 0.055 under the principal-wide block,
  where no owner can let an attacker in. About 0.19 attacker pairs per episode were wrongly
  confirmed. In the five-victims scenario compromise went from 0.000 to 0.046 for that
  reason alone. The gate's compromise check still passed because the rules suffer the same
  wrong confirmations (the weakness stated in the pre-registration).
- **Against the principal-wide block the hold is far less disruptive:** availability 0.900
  against 0.706, own-traffic success 1.000 against 0.887, return -5.28 against -11.70.
- Owner burden: 3.7 confirmation requests per 30-window episode; 1.0 never answered.
- Every policy that acts on the flag lands at the same delegated success (0.777 to 0.791),
  so the shortfall belongs to the control and the owner settings, not to the rule.

## What this means

No pilot control is validated. This is the closest result of the four gates (8 of 9), but
the pass or fail of the delegated-access floor is driven by owner response rate, delay and
error rate, and those three numbers were assumed, not measured. More lab gates with other
assumed values would not settle it. What would: real data on how often and how fast owners
answer and how often they are wrong, or a design that does not depend on the answer (for
example fixing the missing grant data at its source). The `pilot_gate_v4` scenarios are now
exposed. No threshold or owner setting was changed after the run.
