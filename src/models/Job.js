// src/models/Job.js

/**
 * @typedef {Object} JobRecord
 * @property {string} id
 * @property {string} command
 * @property {'pending'|'processing'|'completed'|'failed'|'dead'} state
 * @property {number} attempts
 * @property {number} max_retries
 * @property {string} created_at ISO8601
 * @property {string} updated_at ISO8601
 * @property {string} next_run_at ISO8601
 * @property {string|null} last_error
 * @property {string|null} worker_id
 */

/**
 * Lightweight domain model (keeps logic in services; models describe shape).
 */
export default class Job {
  /** @param {Partial<JobRecord>} props */
  constructor(props = {}) {
    this.id = props.id;
    this.command = props.command;
    this.state = props.state ?? 'pending';
    this.attempts = props.attempts ?? 0;
    this.max_retries = props.max_retries ?? 3;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
    this.next_run_at = props.next_run_at;
    this.last_error = props.last_error ?? null;
    this.worker_id = props.worker_id ?? null;
  }
}
