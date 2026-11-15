# Pilot gate v3: pre-registration (committed before any policy is run on these scenarios)

Decided with Alan (RL owner, with Adam) on 2026-11-14, after the long-block rule failed gate
v2 under the principal-wide block (`results/pilot-gate-v2/REPORT.md`) and the grant-scoped
block was built and measured on already-exposed scenarios
(`results/grant-scoped-block/REPORT.md`).

**This is not an RL result.** The candidate is a fixed rule with no parameters. Whatever the
outcome, `rl-readiness` keeps reporting the first gate's failure for frozen v6, RL stays a
shadow recommender, and nothing is enforced anywhere outside the lab.

## What is tested

- **Candidate:** `always_block_principal_long` (`rl_defense/live/evaluate.py`) with
  `block_scope="ungranted"`: every flagged principal is blocked for the long window, and a
  blocked principal is refused only on requests for another owner's object that no grant in
  the operator's table covers.
- **Incumbent:** the threshold rules re-tuned on `train_v11`
  (`results/live-retrain-v11/rules_tuning.json`, sha256
  `cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd`), **run under the same
  scoped block**. Giving the incumbent the same control is the stricter comparison: the
  candidate has to beat the rules as a rule, not just inherit the benefit of the new block.
- **Reported only, same episodes:** the two other fixed rules, no-op and frozen v6 under the
  scoped block; the candidate, the rules and frozen v6 under the principal-wide block
  (`<name>@principal`).

## Scenarios

`configs/live/pilot_gate_v3/`, written for this gate, disjoint in name and seed from every
other directory, 30 episodes each, never run before this commit:

| Scenario | Seeds | Grant table |
|---|---|---|
| gate3_stale_grant_bookkeeper | 43700-43729 | one of two delegations missing (`erin:carol`) |
| gate3_empty_grant_table | 44700-44729 | the only delegation missing (`dave:alice`) |
| gate3_delegate_and_outsider_mixed | 45200-45229 | complete |
| gate3_steady_outsider_pair | 46200-46229 | complete |

A missing grant (`LiveScenario.missing_grants`) means the business authorized the delegate
but the operator's table has no entry. The delegate's reads are still legitimate traffic:
they count as benign requests in availability, false disruption and delegated success, and
the detector and the scoped block see them as ungranted. Two of four scenarios have this
case because without it the scoped block cannot refuse legitimate work by construction
(the limit stated in the grant-scoped-block report). The scenario parameters were chosen
without running any policy on them.

## Thresholds: unchanged from gates 1 and 2

The eight checks of `results/pilot-gate/PREREGISTRATION.md` plus the paired-episodes check:
`configs/live/promotion.yaml` (sha256 pinned in `pilot_gate.py`) with the rules as incumbent
(paired return CI low > 0, compromise not worse, availability >= 0.85, false disruption
<= 0.25, attack-free defense duty <= 0.5, beats the rules, no scenario below the rules) and
pooled delegated success >= 0.85, where delegated traffic includes the delegates whose
grant is missing. Every check must pass; an undefined metric fails.

Also reported, not gated: delegated success split into listed and unlisted grants, pooled
and per scenario.

## One run

```sh
PYTHONPATH=.:../shared:../standards:../examples/payments-lite/target \
  .venv/bin/python -m rl_defense.live.pilot_gate --out results/pilot-gate-v3 \
  --scenario-dir pilot_gate_v3 --candidate-rule always_block_principal_long \
  --block-scope ungranted \
  --rules-tuning results/live-retrain-v11/rules_tuning.json \
  --rules-tuning-sha256 cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd \
  --reference-v6
```

After this run the scenarios are exposed and cannot be reused as evidence.

## What I expect, written before the run

On the two complete-table scenarios the scoped block should refuse no legitimate request.
On the two missing-grant scenarios the unlisted delegate will be flagged, blocked and
refused on nearly all of their delegated reads after the first window. Whether the pooled
delegated-success floor (0.85) and the attack-free defense-duty cap (0.5) hold with that
loss is not known; I have not computed it and no scenario parameter was adjusted toward
either outcome.

## What a result means

- **Pass:** in the lab, on unseen scenarios including missing grants, the rule with the
  scoped block met the approved pilot thresholds. It is then a candidate for the
  owner-approval step as a pilot control. It does not enable enforcement; use against a real
  application goes through the existing owner authorization and approval path, and depends
  on that application's grant data, which this lab does not model beyond a missing entry.
- **Fail:** reported as measured, with the failing checks. No threshold is changed after the
  run and the scenarios are not rerun with different settings.
