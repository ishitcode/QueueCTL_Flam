// src/services/JobService.js
import { nanoid } from 'nanoid';
import db from '../db.js';
import Job from '../models/Job.js';

/** ISO timestamp (UTC). */
export const nowISO = () => new Date().toISOString();

class JobService {
  /**
   * Enqueue a job.
   * @param {Partial<Job>} payload
   * @returns {string} job id
   */
  enqueue(payload) {
    const id = payload.id || `job_${nanoid(12)}`;
    const command = payload.command;
    if (!command) throw new Error('Job "command" is required');

    const maxRetries = payload.max_retries ?? Number(this.getConfig('max_retries'));
    const created = payload.created_at ?? nowISO();
    const updated = payload.updated_at ?? created;
    const nextRunAt = payload.next_run_at ?? created;
    const stmt = db.get().prepare(`
      INSERT INTO jobs(id, command, state, attempts, max_retries, created_at, updated_at, next_run_at, last_error, worker_id)
      VALUES(?, ?, 'pending', 0, ?, ?, ?, ?, NULL, NULL)
    `);
    stmt.run(id, command, maxRetries, created, updated, nextRunAt);
    return id;
  }

  list({ state, limit }) {
    let sql = `SELECT * FROM jobs`;
    const args = [];
    if (state) {
      sql += ` WHERE state = ?`;
      args.push(state);
    }
    sql += ` ORDER BY created_at`;
    if (limit) sql += ` LIMIT ${Number(limit)}`;
    return db.get().prepare(sql).all(...args);
  }

  status() {
    const rows = db.get().prepare(`
      SELECT state, COUNT(*) as count FROM jobs GROUP BY state
    `).all();
    const counts = Object.fromEntries(rows.map(r => [r.state, r.count]));
    const workers = db.get().prepare(`SELECT * FROM workers`).all();
    const running = workers.filter(w => w.status === 'running').length;
    return {
      counts: {
        pending: counts.pending || 0,
        processing: counts.processing || 0,
        completed: counts.completed || 0,
        failed: counts.failed || 0,
        dead: counts.dead || 0
      },
      workers: { running, total: workers.length, entries: workers }
    };
  }

  dlqList() {
    return this.list({ state: 'dead' });
  }

  dlqRetry(jobId) {
    const j = db.get().prepare(`SELECT * FROM jobs WHERE id=?`).get(jobId);
    if (!j) throw new Error(`Job not found: ${jobId}`);
    if (j.state !== 'dead') throw new Error('Only dead jobs can be retried.');
    const ts = nowISO();
    db.get().prepare(`
      UPDATE jobs
      SET state='pending', attempts=0, updated_at=?, next_run_at=?, last_error=NULL, worker_id=NULL
      WHERE id=?
    `).run(ts, ts, jobId);
    return true;
  }

  /**
   * Atomically claim next runnable job.
   * Uses an immediate transaction to prevent double-claim.
   * @param {string} workerId
   * @returns {Job|null}
   */
  claimNext(workerId) {
    const ts = nowISO();
    const tx = db.get().transaction(() => {
      const job = db.get().prepare(`
        SELECT * FROM jobs
        WHERE state IN ('pending','failed') AND next_run_at <= ?
        ORDER BY created_at
        LIMIT 1
      `).get(ts);

      if (!job) return null;

      db.get().prepare(`
        UPDATE jobs SET state='processing', updated_at=?, worker_id=?
        WHERE id=?
      `).run(ts, workerId, job.id);

      return db.get().prepare(`SELECT * FROM jobs WHERE id=?`).get(job.id);
    });

    return tx();
  }

  handleSuccess(jobId) {
    db.get().prepare(`
      UPDATE jobs
      SET state='completed', updated_at=?, last_error=NULL, worker_id=NULL
      WHERE id=?
    `).run(nowISO(), jobId);
  }

  handleFailure(job, exitCode, output, backoffBase) {
    const attempts = Number(job.attempts) + 1;
    const max = Number(job.max_retries);
    const ts = nowISO();
    if (attempts > max) {
      db.get().prepare(`
        UPDATE jobs SET state='dead', attempts=?, updated_at=?, last_error=?, worker_id=NULL
        WHERE id=?
      `).run(attempts, ts, `exit=${exitCode} output=${(output || '').slice(-1000)}`, job.id);
      return;
    }

    const delaySec = Math.pow(Number(backoffBase), attempts);
    const nextRun = new Date(Date.now() + delaySec * 1000).toISOString();
    db.get().prepare(`
      UPDATE jobs
      SET state='failed', attempts=?, updated_at=?, next_run_at=?, last_error=?, worker_id=NULL
      WHERE id=?
    `).run(attempts, ts, nextRun, `exit=${exitCode} output=${(output || '').slice(-1000)}`, job.id);
  }

  getConfig(key) {
    const row = db.get().prepare(`SELECT value FROM config WHERE key=?`).get(key);
    if (!row) throw new Error(`Config key not found: ${key}`);
    return row.value;
  }
}

export default new JobService();
