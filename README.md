# queuectl (Node.js + Express + CLI)

A lightweight CLI-based background job queue with:

## Install

```bash
git clone <your-repo-url>
cd queuectl-node
npm i
npm run init

---

Lightweight CLI-based background job queue with:

- SQLite persistence via `better-sqlite3`
- Worker pool using `worker_threads` (workers execute shell commands)
- Automatic retries with exponential backoff
- Dead Letter Queue (DLQ) for permanently failed jobs
- Graceful shutdown and simple config management
- Small Express API for integration + a CLI (`queuectl`)

This README documents how to set up, run, and test the project after the recent improvements (central dispatcher, exec-only worker threads, safer CLI enqueue options, and several test scripts).

## Requirements

- Node.js >= 18
- Git (optional)

## Quick setup

Open PowerShell and run:

```powershell
cd D:\queuectl_node
npm install
# initialize the SQLite DB (creates tables and default config)
npm run init
```

## Key commands (CLI)

The repository provides a CLI executable at `cli/queuectl.js`. Use `node cli/queuectl.js` or install via npm `bin` if you prefer.

Examples (PowerShell-friendly):

Enqueue a job by passing a shell command (recommended on PowerShell):

```powershell
node cli/queuectl.js enqueue --command "echo hello from job1"
```

Enqueue from a JSON file:

```powershell
node cli/queuectl.js enqueue --file ./job.json
```

List jobs by state:

```powershell
node cli/queuectl.js list --state pending
node cli/queuectl.js list --state completed
```

Show overall status (job counts + workers):

```powershell
node cli/queuectl.js status
```

DLQ commands:

```powershell
node cli/queuectl.js dlq:list
node cli/queuectl.js dlq:retry <jobId>
```

Config commands:

```powershell
node cli/queuectl.js config get max_retries
node cli/queuectl.js config set backoff_base 2
```

Worker control (recommended: use the persistent runner):

Start a persistent runner that manages worker threads:

```powershell
node scripts/run_workers.js --count 3
```

This spawns worker threads in a long-lived process and dispatches jobs to them. Avoid running multiple runner instances against the same DB.

To request graceful shutdown (set shutdown flag):

```powershell
node cli/queuectl.js worker:stop
```

Note: `worker start` (via CLI) spawns worker threads owned by the CLI process; the `scripts/run_workers.js` runner is recommended for persistent background processing.

## Test scripts

Several helper scripts were added to exercise functionality locally:

- `scripts/run_workers.js --count N` — start a persistent runner that manages N worker threads
- `scripts/test_many_jobs.js` — enqueues a mix of successful and failing jobs to exercise retries and DLQ
- `scripts/wait_until_all_completed.js` — polls job status and exits when no pending/processing jobs remain
- `scripts/dump_db.js` — prints config, workers and the first 50 jobs for debugging
- `scripts/count_recent_jobs.js [minutes]` — report counts globally and for recent N minutes

Example flow to run the multi-job test (clean DB advised):

1. Stop any running runner(s) or Node processes that may hold DB locks.
2. Optionally reset DB (destructive):

```powershell
Stop-Process -Name node -Force   # stop runners
Remove-Item .\\queuectl.db
npm run init
```

3. Start runner in one terminal:

```powershell
node scripts/run_workers.js --count 3
```

4. In another terminal, run test and wait:

```powershell
node scripts/test_many_jobs.js
node scripts/wait_until_all_completed.js
```

If you want a fully clean run without touching the DB file manually, I can add a `cli` command to reset DB state.

## Architecture (short)

- Persistence: `better-sqlite3` (synchronous API) with WAL mode and a small busy timeout. The DB schema lives in `src/db.js` and includes `jobs`, `workers`, and `config` tables.
- Job domain: `src/models/Job.js` describes job fields. `src/services/JobService.js` contains logic to enqueue, claim, handle success/failure, compute backoff, and move to DLQ.
- Worker model: `src/services/WorkerService.js` now acts as a central dispatcher (main process). It claims jobs from the DB and posts job payloads to lightweight exec-only worker threads (`src/workers/worker.js`) which only execute the command and return results. This avoids multiple threads opening the DB concurrently and reduces SQLITE_BUSY issues.
- CLI/API: `cli/queuectl.js` provides the CLI and uses services. `src/app.js` exposes a small Express API with routes in the `routes/` folder.

## Important implementation notes & assumptions

- Commands are executed with `child_process.spawn(command, { shell: true })`. Behavior depends on the platform shell (PowerShell/cmd on Windows, bash/sh on Unix). For cross-platform test commands prefer simple `echo` or a JS script file.
- Retry/backoff: backoff uses delay = base^attempts seconds and `max_retries` per job determines when to move to `dead` state.
- Locking: to reduce SQLITE_BUSY errors we set `PRAGMA busy_timeout` and keep DB access centralized.
- The system stores job `next_run_at` and uses it when claiming jobs. Jobs are selected by created_at order for simplicity.

## Troubleshooting

- If you see `SQLITE_BUSY` errors, ensure only a single runner process is active and use the persistent runner instead of starting many CLI worker processes.
- If old jobs pollute tests, either remove `queuectl.db` and `npm run init` or purge dead jobs via the DB helper:

```powershell
node -e "import db from './src/db.js'; db.init(); db.get().prepare(\"DELETE FROM jobs WHERE state='dead'\").run(); console.log('deleted dead jobs');"
```

## Next steps / improvements you can add

- Add a `cli` command to purge DLQ or reset DB safely with confirmation.
- Add unit/integration tests (e.g., using a temp DB file) and an `npm test` script.
- Add job output logging, per-job execution duration metrics, or a small web dashboard.

---

If you'd like, I can now:
- add a `queuectl dlq:clear` command to purge dead jobs, or
- add a one-command `npm run clean-test` that resets the DB, starts the runner, runs the test, and reports results.

Tell me which and I will implement it next.
git clone <your-repo-url>
