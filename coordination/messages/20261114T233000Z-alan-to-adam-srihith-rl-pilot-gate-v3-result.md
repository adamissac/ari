# Pilot gate v3 result: FAIL (lab only, not an RL result)

From: Alan (via agent). To: Adam, Srihith. 2026-11-14.

- Candidate: fixed rule `always_block_principal_long` under the grant-scoped block. Fresh
  scenarios, two of four with a grant missing from the operator's table. Pre-registered
  (`ae75c558`), run once, thresholds unchanged.
- Failed 3 of 9 checks: delegated success 0.693 (floor 0.85), legitimate traffic blocked in
  64% of attack-free windows (cap 50%), -0.90 on one scenario.
- With a complete grant table nothing legitimate was refused. With a missing grant the
  delegate loses all delegated reads under every policy that acts on the detector's flag.
- No backend, contract or readiness change. No pilot control is validated. Adam: the gate
  thresholds were approved by Alan only; your review is still open.
- Report: `rl-defense/results/pilot-gate-v3/REPORT.md`.
