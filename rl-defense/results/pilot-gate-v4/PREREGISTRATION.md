# Pilot gate v4: pre-registration (committed before any policy is run on these scenarios)

Decided with Alan (RL owner, with Adam) on 2026-11-15, after gate v3 failed on missing
grants (`results/pilot-gate-v3/REPORT.md`) and the hold-for-owner-confirmation control was
built and measured on already-exposed scenarios (`results/confirm-hold/REPORT.md`).

**This is not an RL result.** The candidate is a fixed rule with no parameters. Whatever the
outcome, `rl-readiness` keeps reporting the first gate's failure for frozen v6, RL stays a
shadow recommender, and nothing is enforced anywhere outside the lab.

## What is tested

- **Candidate:** `always_block_principal_long` with `block_scope="confirm"`: a blocked
  principal's ungranted cross-tenant request is held, the object's owner is asked once per
  (principal, owner) pair, a confirmed pair is let through, a denied or unanswered pair
  stays held.
- **Incumbent:** the threshold rules re-tuned on `train_v11`
  (`results/live-retrain-v11/rules_tuning.json`, sha256
  `cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd`), under the same
  control and the same owner settings.
- **Reported only, same episodes:** the other fixed rules, no-op and frozen v6 under the
  same control; the candidate, the rules and frozen v6 under the principal-wide block.

## Owner settings, fixed here

| Setting | Value | Meaning |
|---|---|---|
| `confirm_delay` | 4 | windows until an owner's answer lands |
| `confirm_response_p` | 0.75 | chance an owner answers at all |
| `confirm_error_p` | 0.10 | chance an answer is wrong, either way |

A wrong answer confirms a reader the business never authorized (an attacker, who is then
neither flagged nor refused for that owner for the rest of the episode) or denies a
legitimate delegate (who stays held). The owner is simulated. These values are not from
real data; none exists here. They were chosen as plausible, harder than the diagnostic's
settings, and without running any policy on these scenarios.

## Scenarios

`configs/live/pilot_gate_v4/`, written for this gate, disjoint in name and seed from every
other directory, 30 episodes each, never run before this commit:

| Scenario | Seeds | Grant table |
|---|---|---|
| gate4_both_grants_missing | 45600-45629 | both delegations missing |
| gate4_insider_beside_unlisted_delegate | 46700-46729 | one of two missing; the listed delegate is the attacker |
| gate4_outsider_five_victims | 47200-47229 | complete; five owners asked about one attacker |
| gate4_quiet_day_rare_insider | 48200-48229 | complete |

## Thresholds: unchanged from gates 1 to 3

The nine checks of gate v3: paired episodes match, `configs/live/promotion.yaml` with the
rules as incumbent (paired return CI low > 0, compromise not worse than the rules,
availability >= 0.85, false disruption <= 0.25, attack-free defense duty <= 0.5, beats the
rules, no scenario below the rules) and pooled delegated success >= 0.85 including
delegates whose grant is missing. Every check must pass; an undefined metric fails.

Reported, not gated: delegated success for listed and unlisted grants, and owner
confirmations per episode (requested, confirmed, denied, unanswered, wrongly confirmed,
wrongly denied), pooled and per scenario.

**Stated weakness of the compromise check.** It compares the candidate with the rules under
the same control, so wrong confirmations hurt both. The absolute cost of wrong confirmations
is therefore reported separately: the candidate's compromise rate here against the same
rule, same episodes, under the principal-wide block (`candidate@principal`), where no owner
can let an attacker in. That difference is reported whatever the gate verdict.

## One run

```sh
PYTHONPATH=.:../shared:../standards:../examples/payments-lite/target \
  .venv/bin/python -m rl_defense.live.pilot_gate --out results/pilot-gate-v4 \
  --scenario-dir pilot_gate_v4 --candidate-rule always_block_principal_long \
  --block-scope confirm --confirm-delay 4 --confirm-response-p 0.75 --confirm-error-p 0.1 \
  --rules-tuning results/live-retrain-v11/rules_tuning.json \
  --rules-tuning-sha256 cb9b19a3a18b0fd19bb7370679ad0c008a618f54a0f415418eb2d7abc961c8cd \
  --reference-v6
```

After this run the scenarios are exposed and cannot be reused as evidence.

## What I expect, written before the run

I do not know the verdict. A quarter of owners never answer, so in the two missing-grant
scenarios some delegates stay held for the whole episode; whether pooled delegated success
stays above 0.85 is uncertain. Wrong confirmations should raise the candidate's compromise
above its principal-wide value, most in the five-victims scenario.

## What a result means

- **Pass:** in the lab, with a simulated owner at these settings, the rule with the hold met
  the approved thresholds on unseen scenarios. It would be a candidate for the
  owner-approval step as a pilot control. It enables nothing: there is no notification, UI
  or audit path for confirmations, and real owner response rates and error rates are unknown.
- **Fail:** reported as measured with the failing checks. No threshold or owner setting is
  changed after the run and the scenarios are not rerun.
