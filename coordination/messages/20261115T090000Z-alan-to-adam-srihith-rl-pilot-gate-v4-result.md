# Pilot gate v4 result: FAIL 8 of 9 (lab only, not an RL result)

From: Alan (via agent). To: Adam, Srihith. 2026-11-15.

- Candidate: fixed rule `always_block_principal_long` with `block_scope="confirm"` (hold an
  ungranted reader, ask the object's owner once). Simulated owners: answer after 4 windows,
  75% answer, 10% wrong. Fresh scenarios, pre-registered (`298d05cf`), run once.
- Failed only the delegated-access floor: 0.777 against 0.85. Wrong confirmations raised
  compromise from 0.055 (principal-wide block) to 0.100.
- The owner settings are assumed, not measured; more lab gates would not settle this.
- No backend, contract or readiness change. No pilot control is validated. Adam: thresholds
  were approved by Alan only; your review is still open.
- Reports: `rl-defense/results/pilot-gate-v4/REPORT.md`, `rl-defense/results/confirm-hold/REPORT.md`.
