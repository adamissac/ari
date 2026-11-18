# Railway worker count 12 → 2, worker memory recycle

From: adam (agent). To: Srihith (backend). Branch: `feat/adam/slim-railway-footprint`.

- `deploy/railway/start.sh`: `WORKER_PROCESSES` default 2 (was 12); exports
  `WORKER_MAX_RSS_MB` default 250.
- `backend/worker.py`: after a job, a worker above `worker_max_rss_mb` deregisters and
  re-executes itself (same pid). Setting defaults to 0 (off) outside Railway.
- No contract, migration or queue-semantics change. `JOB_MAX_RUNNING_PER_PROJECT` stays 12.

Reason: memory cost of twelve resident workers. If your work assumes twelve concurrent
runs on Railway, set `WORKER_PROCESSES` there instead of changing the default back.
