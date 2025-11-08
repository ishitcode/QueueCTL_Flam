# queuectl (Node.js + Express + CLI)

A production-ready background job queue with:
- **SQLite** persistence (`better-sqlite3`)
- **Multiple workers** (`worker_threads`)
- **Exponential backoff** retries
- **Dead Letter Queue (DLQ)**
- **Graceful shutdown**
- **Config management**
- **Express REST API** for integration
- **CLI** for local control

## Install

```bash
git clone <your-repo-url>
cd queuectl-node
npm i
npm run init
