# 🚀 QueueCTL - Background Job Queue System

A **minimal, production-grade CLI-based background job queue** built with **Node.js**, **Worker Threads**, and **SQLite**.  
QueueCTL allows you to enqueue shell commands as background jobs, process them with multiple workers, automatically retry failed jobs using exponential backoff, and manage a **Dead Letter Queue (DLQ)** for permanently failed tasks.

---

## 🧩 Features Overview

| Feature | Description |
|----------|-------------|
| 🧠 **Job Queue System** | Enqueue any shell command (`echo`, `sleep`, etc.) for background execution. |
| ⚙️ **Multiple Workers** | Run several worker threads concurrently to process jobs in parallel. |
| 🔁 **Retry & Exponential Backoff** | Automatically retry failed jobs: delay = base ^ attempts. |
| 🪦 **Dead Letter Queue (DLQ)** | Permanently failed jobs moved to DLQ after `max_retries`. |
| 💾 **Persistence** | All jobs and configs stored in SQLite for durability across restarts. |
| ⚡ **CLI Interface** | Clean, PowerShell-friendly CLI built with `commander`. |
| 🧰 **Config Management** | Manage retry count and backoff base dynamically via CLI. |
| 🧱 **Graceful Shutdown** | Workers complete current job before exiting. |
| 🧪 **Testing Script** | Includes automated flow test (`test/verify_core_flows.js`). |

---

## 🛠️ Tech Stack

- **Node.js (v18+)**
- **Express.js** (for optional API endpoints)
- **SQLite (better-sqlite3)** — persistent, embedded storage  
- **Worker Threads** — for concurrent background execution  
- **Commander.js** — for CLI interface  

---

## ⚙️ Setup Instructions

### 1️⃣ Clone Repository
```bash
git clone https://github.com/ishitcode/QueueCTL_Flam.git
cd QueueCTL_Flam-main
```
### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Initialize Database
```bash
node -e "import('./src/db.js').then(m=>m.default.init())"
```

### 4️⃣ Run the CLI
```PowerShell
node cli/queuectl.js enqueue --command "echo hello"
```
```bash
node cli/queuectl.js enqueue '{"command":"echo hello"}'
```

## 💻 Usage Examples

### 🧩 Enqueue Jobs
```bash
# PowerShell-safe
node cli/queuectl.js enqueue --command "echo hello from QueueCTL"

# JSON input (bash)
node cli/queuectl.js enqueue '{"command":"sleep 2"}'
```

### 🧵 Start Workers
```bash
# Start 2 workers
node cli/queuectl.js worker start --count 2
```

### 🛑 Stop Workers Gracefully
```bash
node cli/queuectl.js worker stop
```

### 📊 View System Status
```bash
node cli/queuectl.js status
```

### 📋 List Jobs
```bash
node cli/queuectl.js list --state pending
```

### ☠️ Dead Letter Queue
```bash
node cli/queuectl.js dlq list
node cli/queuectl.js dlq retry job_ABC123
```

### ⚙️ Manage Config
```bash
node cli/queuectl.js config get max-retries
node cli/queuectl.js config set max-retries 5
node cli/queuectl.js config set backoff_base 3
```
# 🧠 Architecture Overview

## 🏗️ Components

| Module | Responsibility |
|---------|----------------|
| **JobService** | Handles job creation, updates, retries, and DLQ transitions. |
| **WorkerService** | Spawns, tracks, and gracefully stops worker threads. |
| **ConfigService** | Stores and retrieves dynamic configuration (retry count, backoff base). |
| **DB** | SQLite wrapper for persistent data storage. |
| **CLI (queuectl.js)** | User interface to enqueue, control, and monitor jobs. |

---

## 🔄 Job Lifecycle

| State | Description |
|--------|--------------|
| **pending** | Waiting to be picked up by a worker |
| **processing** | Currently being executed |
| **completed** | Successfully executed |
| **failed** | Failed, but retryable |
| **dead** | Permanently failed (moved to DLQ) |

### Flow:

```
enqueue → pending
worker picks job → processing
if success → completed
if fail → failed → retry (delay = base^attempts)
after max retries → dead (DLQ)
```


---

## 💾 Persistence

All jobs, workers, and configs are persisted in `queuectl.db` (SQLite).  
Data survives restarts, ensuring reliability in production-like environments.

---

## 👷 Worker Logic

Multiple workers are launched via **worker_threads**.

Each worker:

1. Claims a job atomically from DB.  
2. Spawns a shell process using `child_process.spawn`.  
3. Reports result back to dispatcher.  
4. Handles retry or completion.  
5. Gracefully shuts down, ensuring ongoing jobs complete before exit.

---

## ⚖️ Assumptions & Trade-offs

| Decision | Rationale |
|-----------|------------|
| **SQLite instead of Redis** | Lightweight, persistent, no external dependency. |
| **Synchronous DB access (better-sqlite3)** | Thread-safe, transactional integrity, no async race issues. |
| **No job priority yet** | Focused on stability and correctness first; easily extendable. |
| **Timeouts optional** | Current version executes until process exits; can be extended. |
| **CLI-first design** | Matches assignment requirement (no web UI necessary). |

---

## 🧪 Testing Instructions

### ▶️ Automated Flow Test

Run the ready-made test script to validate core functionality:

```bash
node test/verify_core_flows.js
```
What it does:

Initializes DB
Enqueues:
✅ 1 success job (echo success test)
❌ 1 failing job (notarealcommand)
Starts 2 workers
Waits 10 seconds
Prints job summary

🧪 QueueCTL Core Flow Test
--------------------------
→ Enqueueing 2 jobs...
→ Starting 2 workers...
[dispatcher] claimed job_x for worker=w_1
[dispatcher] claimed job_y for worker=w_2
Command failed: notarealcommand (ENOENT)
→ Checking job statuses after 10 seconds...
{
  "counts": {
    "completed": 1,
    "dead": 1
  }
}
✅ Test run complete.

## 🧩 Assessed System Requirements

| Requirement | Implemented | Description |
|--------------|--------------|--------------|
| **Job Execution** | ✅ | Executes shell commands with exit code handling |
| **Retry & Backoff** | ✅ | Exponential backoff (`base^attempts`) |
| **Persistence** | ✅ | Durable SQLite database |
| **Worker Management** | ✅ | Multi-threaded, atomic job claim, graceful shutdown |
| **Configuration** | ✅ | CLI-based dynamic configuration |

---

## 🧾 Test Scenarios Summary

| Scenario | Result |
|-----------|---------|
| ✅ Basic job completes | Success |
| ✅ Failed job retries → DLQ | Success |
| ✅ Multiple workers no overlap | Success |
| ✅ Invalid command handled | Success |
| ✅ Data persists after restart | Success |


## 🧾 Author

**ISHIT JAIN**  


**QueueCTL © 2025**




