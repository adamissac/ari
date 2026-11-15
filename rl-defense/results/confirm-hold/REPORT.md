# Hold for owner confirmation: what it changes

_Measured against the owned demo app in the isolated in-process lab. Diagnostic on the gate
v3 scenarios, which gate v3 already exposed. Not a gate. The owner's answer is simulated._

`block_scope="confirm"` (`LoopConfig`, off by default): a blocked principal's ungranted
cross-tenant request is refused as a hold. The loop asks the object's owner once per
(principal, owner) pair. A confirmed pair is let through from then on; a denied or unanswered
pair stays held. Command: `python -m rl_defense.live.confirm_study --out results/confirm-hold`;
raw numbers in [`confirm_study.json`](confirm_study.json). 4 scenarios x 30 episodes, same
episodes for every row. Policy: `always_block_principal_long`.

| Setting | Return | Compromise | Availability | Delegated success (unlisted grants) | Attack-free windows with a legitimate block |
|---|---|---|---|---|---|
| Grant-scoped block (gate v3) | -6.09 | 0.098 | 0.873 | 0.693 (0.000) | 0.641 |
| Confirm, answer after 2 windows | -2.01 | 0.098 | 0.987 | 0.969 (0.898) | 0.069 |
| Confirm, answer after 8 windows | -2.91 | 0.098 | 0.962 | 0.908 (0.702) | 0.201 |
| Confirm, 2 windows, half of owners answer | -3.64 | 0.098 | 0.943 | 0.862 (0.549) | 0.304 |

Gate thresholds for reference: availability >= 0.85, delegated success >= 0.85, attack-free
blocks <= 0.5.

## Reading

- With the long-block rule, compromise is identical in every setting (0.098). A hold refuses
  exactly what the scoped block refused, and no attacker pair was ever confirmed.
- The loss gate v3 found is mostly recovered when owners answer: the delegate with a missing
  grant is held for the delay, then let through. The two complete-table scenarios are
  unchanged (nothing legitimate was refused there before either).
- The result degrades with slower or missing answers, as expected. At half of owners
  answering, the empty-grant-table scenario alone is at delegated success 0.492 and
  attack-free blocks 0.503.
- Owner burden: about 3.9 confirmation requests per 30-window episode, of which 0.5 are
  legitimate and 3.4 are about attackers. Owners are mostly being asked about attacks.
- The other policies behave differently once pairs are confirmed, because the detector's
  flags change: the threshold rules' compromise rose (0.268 to 0.378 at 2 windows) and
  frozen v6's fell (0.269 to 0.201). The cause was not investigated.

## What this does not show

- **It is not a gate pass.** These scenarios were already exposed, and the settings were
  chosen after seeing gate v3.
- **The owner is simulated and never wrong.** An owner who answers confirms exactly the
  delegations the business authorized. A real owner can approve an attacker (by mistake or
  through social engineering), and that turns this control into a way to obtain access. The
  lab has no such case, so the unchanged compromise rate says nothing about it.
- **Delay is in lab windows**, not hours; no real response-time data is behind 2 or 8.
- No notification, UI or audit path for confirmations exists. This is a lab control only;
  backend, contracts and RL readiness are unchanged.

## If a pilot control is still wanted

A fourth pre-registered gate on fresh scenarios with this control, with response rate and
delay fixed in advance, and with owners who sometimes wrongly confirm an attacker. Without
the wrong-confirmation case the compromise check cannot fail for this control.
