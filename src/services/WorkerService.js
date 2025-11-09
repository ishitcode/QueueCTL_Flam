// src/services/WorkerService.js
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import db from '../db.js';
import Config from './ConfigService.js';
import JobService, { nowISO } from './JobService.js';
const WORKER_FILE = path.join(process.cwd(), 'src', 'workers', 'worker.js');

class WorkerService {
  constructor() {
    /** @type {Map<string, { worker: Worker, busy: boolean }>} */
    this.pool = new Map();
    this.dispatchInterval = null;
  }

  start(count = 1) {
    Config.setShutdown(false);
    const ids = [];
    for (let i = 0; i < count; i++) {
      const id = `w_${Math.random().toString(36).slice(2, 10)}`;
      const w = new Worker(WORKER_FILE, { workerData: { id } });
      this.pool.set(id, { worker: w, busy: false });
      ids.push(id);

      this._upsertWorkerRow(id, 'running');

      w.on('message', (msg) => this._onWorkerMessage(id, msg));
      w.on('exit', () => this._onWorkerExit(id));
      w.on('error', (err) => this._onWorkerError(id, err));
    }

    // Start dispatcher if not running
    if (!this.dispatchInterval) {
      this.dispatchInterval = setInterval(() => this._dispatch(), 200);
    }

    return ids;
  }

  stopGracefully() {
    Config.setShutdown(true);
    // inform workers to stop after current job
    for (const [id, info] of this.pool.entries()) {
      try { info.worker.postMessage({ type: 'shutdown' }); } catch (e) {}
    }
    if (this.dispatchInterval) {
      clearInterval(this.dispatchInterval);
      this.dispatchInterval = null;
    }
    return true;
  }

  async _dispatch() {
    if (Config.shutdownFlag()) return;
    const pollMs = Number(Config.get('poll_interval')) || 1000;
    const jobTimeoutMs = Number(Config.get('job_timeout_ms')) || 0;
    const backoffBase = Number(Config.get('backoff_base')) || 2;

    for (const [id, info] of this.pool.entries()) {
      if (info.busy) continue;

      // Try to claim one job for this worker
      let job = null;
      try {
        job = JobService.claimNext(id);
      } catch (e) {
        job = null;
      }

      if (!job) continue;

      // mark busy and send job to worker
      console.log(`[dispatcher] claimed job=${job.id} for worker=${id}`);
      info.busy = true;
      try {
        info.worker.postMessage({ type: 'run', job, timeoutMs: jobTimeoutMs });
      } catch (e) {
        console.error(`[dispatcher] failed to post job ${job.id} to worker ${id}:`, e.message || e);
        // posting failed, mark job back to pending
        info.busy = false;
        db.get().prepare("UPDATE jobs SET state='pending', worker_id=NULL WHERE id=?").run(job.id);
      }
    }
  }

  _onWorkerMessage(id, msg) {
    if (!msg) return;
    if (msg.type === 'result') {
      const { jobId, code, output } = msg;
      // load JobService and call appropriate handler
      const jobRow = db.get().prepare('SELECT * FROM jobs WHERE id=?').get(jobId);
      if (!jobRow) {
        // nothing to do
      } else if (code === 0) {
        JobService.handleSuccess(jobId);
      } else {
        JobService.handleFailure(jobRow, code, output, Number(Config.get('backoff_base')));
      }

      // mark worker free
      const info = this.pool.get(id);
      if (info) info.busy = false;
      this._heartbeat(id, 'running');
    } else if (msg.type === 'stopped') {
      this._setStatus(id, 'stopped');
      this.pool.delete(id);
    }
  }

  _onWorkerExit(id) {
    this._setStatus(id, 'stopped');
    this.pool.delete(id);
  }

  _onWorkerError(id, err) {
    this._setStatus(id, 'stopped');
    this.pool.delete(id);
    console.error(`Worker ${id} error:`, err);
  }

  _upsertWorkerRow(id, status) {
    const ts = nowISO();
    db.get().prepare(`
      INSERT INTO workers(id, started_at, heartbeat_at, status)
      VALUES(?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET heartbeat_at=excluded.heartbeat_at, status=excluded.status
    `).run(id, ts, ts, status);
  }

  _heartbeat(id, status) {
    db.get().prepare(`UPDATE workers SET heartbeat_at=?, status=? WHERE id=?`).run(nowISO(), status, id);
  }

  _setStatus(id, status) {
    db.get().prepare(`UPDATE workers SET status=?, heartbeat_at=? WHERE id=?`).run(status, nowISO(), id);
  }
}

export default new WorkerService();
