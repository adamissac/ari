# Pilot gate v3: FAIL (6 of 9 checks pass)

_Measured against the owned demo app in the isolated in-process lab. Lab evidence only. The
candidate is a fixed rule, not a learned policy; RL readiness is unchanged._

Pre-registered in [`PREREGISTRATION.md`](PREREGISTRATION.md) (commit `ae75c558`, before the
run). Run once at that commit; raw numbers in [`summary.json`](summary.json) and
[`episodes.json`](episodes.json), hashes in [`EVIDENCE.json`](EVIDENCE.json). Candidate:
`always_block_principal_long` with the grant-scoped block. Incumbent: the re-tuned threshold
rules under the same block. 4 scenarios x 30 episodes, two with a missing grant.

## Checks

| Check | Candidate | Threshold | |
|---|---|---|---|
| Paired episodes match | 120 / 120 | identical | pass |
| Paired return gain over rules, CI low | +1.21 (mean +1.80) | > 0 | pass |
| Compromise rate | 0.098 | <= rules (0.268) | pass |
| Availability | 0.873 | >= 0.85 | pass |
| False disruption | 0.156 | <= 0.25 | pass |
| Beats the rules on return | -6.09 vs -7.89 | > rules | pass |
| Attack-free windows with legitimate traffic blocked | 0.641 | <= 0.5 | **fail** |
| Worst scenario against the rules | -0.90 | >= 0 | **fail** |
| Delegated success | 0.693 | >= 0.85 | **fail** |

## By scenario (candidate, then the rules, same scoped block)

| Scenario | Grant table | Return | Compromise | Availability | Delegated: listed / unlisted |
|---|---|---|---|---|---|
| delegate_and_outsider_mixed | complete | -1.34 / -7.63 | 0.086 / 0.509 | 1.000 / 1.000 | 1.000 / none |
| steady_outsider_pair | complete | -2.14 / -3.58 | 0.088 / 0.150 | 1.000 / 1.000 | 1.000 / none |
| stale_grant_bookkeeper | one of two missing | -9.82 / -8.91 | 0.110 / 0.144 | 0.764 / 0.802 | 1.000 / 0.000 (rules 0.162) |
| empty_grant_table | only grant missing | -11.08 / -11.45 | 0.163 / 0.175 | 0.700 / 0.693 | none / 0.000 (rules 0.021) |

## Reading

- **Complete grant table: the control works as the diagnostic said.** On the two such
  scenarios, unseen until this run, no legitimate or delegated request was refused, and the
  candidate's compromise is 0.09 against the rules' 0.15 to 0.51. This includes the case
  that sank gate v2 (an insider who is also a legitimate delegate).
- **Missing grant: the control refuses all of that delegate's authorized work.** A delegate
  whose grant is absent from the table is flagged in the first window and refused on every
  delegated read after it (0.000 success). Those scenarios lose 24% to 30% of all legitimate
  requests, and legitimate traffic is blocked in every attack-free window. All three failed
  checks come from these two scenarios.
- **The failure is the detector's, not the rule's.** Every policy that acts on the flag
  fails the same absolute checks here: the rules reach delegated success 0.723 and
  attack-free duty 0.575, frozen v6 matches the candidate (0.693, 0.641). Only doing nothing
  passes them, at compromise 1.000. The detector treats "no grant on file" as an attack, and
  no choice of when to block fixes that.
- **The scoped block is still strictly better than the principal-wide one.** Same rule, same
  episodes: return -6.09 against -10.43, availability 0.873 against 0.740, own-traffic
  success 1.000 against 0.892, compromise identical.
- The one scenario where the candidate trails the rules (stale_grant_bookkeeper, -0.90) is
  where the rules block the unlisted delegate less persistently and so refuse less
  authorized work.

## What this means

No pilot control is validated. The rule with the scoped block is safe for legitimate users
only as far as the grant data is complete, and this lab models incompleteness only as a
missing entry. A pilot control would need either a way to tell a missing grant from an
attack (for example holding a first-time ungranted reader for owner confirmation instead of
blocking) or a measured bound on grant-table completeness for the target application. Both
are new work. The `pilot_gate_v3` scenarios are now exposed. No threshold was changed.
