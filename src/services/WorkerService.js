// src/services/WorkerService.js
import { Worker } from 'node:worker_threads';
import path from 'node:path';
import db from '../db.js';
import Config from './ConfigService.js';
import { nowISO } from './JobService.js';

const WORKER_FILE = path.join(process.cwd(), 'src', 'workers', 'worker.js');

class WorkerService {
  constructor() {
    /** @type {Map<string, Worker>} */
    this.pool = new Map();
  }

  /**
   * Start N workers (in this process context, tracked in memory).
   * For production you might delegate to a process manager.
   * @param {number} count
   * @returns {string[]} worker ids
   */
  start(count = 1) {
    Config.setShutdown(false);
    const ids = [];
    for (let i = 0; i < count; i++) {
      const id = `w_${Math.random().toString(36).slice(2, 10)}`;
      const w = new Worker(WORKER_FILE, { workerData: { id } });
      this.pool.set(id, w);
      ids.push(id);

      // create/heartbeat row
      this._upsertWorkerRow(id, 'running');

      w.on('message', (msg) => {
        if (msg?.type === 'heartbeat') {
          this._heartbeat(id, msg.status || 'running');
        }
      });

      w.on('exit', (code) => {
        this._setStatus(id, 'stopped');
        this.pool.delete(id);
      });

      w.on('error', (err) => {
        this._setStatus(id, 'stopped');
        this.pool.delete(id);
        console.error(`Worker ${id} error:`, err);
      });
    }
    return ids;
  }

  stopGracefully() {
    Config.setShutdown(true);
    return true;
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
    db.get().prepare(`
      UPDATE workers SET heartbeat_at=?, status=? WHERE id=?
    `).run(nowISO(), status, id);
  }

  _setStatus(id, status) {
    db.get().prepare(`
      UPDATE workers SET status=?, heartbeat_at=? WHERE id=?
    `).run(status, nowISO(), id);
  }
}

export default new WorkerService();
