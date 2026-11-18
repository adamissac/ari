# Railway: one worker kept free for emergency jobs; recycled worker skips migration check

From: adam (agent). To: Srihith (backend). Branch: `feat/adam/slim-railway-footprint`.
Follows `20261118T234500Z-adam-to-srihith-worker-count-and-memory-recycle.md`.

- `deploy/railway/start.sh`: `WORKER_PROCESSES` default is now 3, and
  `JOB_MAX_RUNNING_GLOBAL` defaults to one below the worker count. Ordinary jobs run 2 at
  a time; `EMERGENCY_JOB_KINDS` are claimed outside the global cap, so they always find a
  free worker. An explicit `JOB_MAX_RUNNING_GLOBAL` (including 0) still wins.
- `backend/cli.py`: a worker re-executed by the memory recycle (`WORKER_RECYCLED=1`) skips
  `preflight.require_migrated()`. It passed at first start; a newer deploy may have
  migrated since, and exiting there stopped the old container before its handoff.
- No contract, migration or claim-SQL change.
