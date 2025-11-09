// src/db.js
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.QUEUECTL_DB || path.join(process.cwd(), 'queuectl.db');

/**
 * Singleton DB wrapper for better-sqlite3 (sync, fast, safe for this use case).
 */
class DB {
  constructor() {
    this.db = new Database(DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    // Wait briefly when database is busy so concurrent workers don't fail immediately
    try {
      this.db.pragma('busy_timeout = 2000');
    } catch (e) {
      // ignore if pragma not supported
    }
  }

  init() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        command TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('pending','processing','completed','failed','dead')),
        attempts INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        next_run_at TEXT NOT NULL,
        last_error TEXT,
        worker_id TEXT
      );

      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        started_at TEXT NOT NULL,
        heartbeat_at TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running','stopping','stopped'))
      );

      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const defaults = {
      max_retries: '3',
      backoff_base: '2',
      poll_interval: '1000', // ms
      shutdown: '0',
      job_timeout_ms: '0' // 0 disables timeout
    };

    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO config(key, value) VALUES (@key, @value)`
    );
    const tx = this.db.transaction(() => {
      for (const [key, value] of Object.entries(defaults)) {
        insert.run({ key, value });
      }
    });
    tx();
  }

  get() {
    return this.db;
  }
}

const singleton = new DB();
export default singleton;
