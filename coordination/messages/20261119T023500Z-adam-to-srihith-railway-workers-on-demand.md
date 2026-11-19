# Railway: workers start on demand (worker pool)

From: adam (agent). To: Srihith (backend). Branch: `feat/adam/on-demand-workers`.
Follows `20261119T001500Z-adam-to-srihith-emergency-worker-and-recycle-preflight.md`.

- `deploy/railway/start.sh` starts `hackatl-worker-pool --max $WORKER_PROCESSES` instead of
  resident `hackatl-worker` processes. `WORKER_ON_DEMAND=false` restores them.
- `backend/worker_pool.py`: each poll interval the pool starts a worker for every job
  `jobs.claimable_count` reports that has no idle worker, up to the limit. The count uses
  the same global and emergency limits as the claim statement; the per-project limit is
  not applied. Workers it starts exit after `WORKER_IDLE_EXIT_S` (60) with nothing to claim.
- The pool runs `execution.reconcile` on `worker_reconcile_interval_s` and beats a
  `pool:<host>:<pid>` row in `worker_heartbeats`. `/readyz` `workers.alive` includes that
  row, so it is 1 with an empty queue.
- No contract, migration or claim-SQL change. `hackatl-worker` without the pool behaves
  as before (`worker_idle_exit_s` defaults to 0).
