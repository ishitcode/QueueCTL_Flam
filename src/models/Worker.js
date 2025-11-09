// src/models/Worker.js

/**
 * @typedef {'running'|'stopping'|'stopped'} WorkerStatus
 */

export default class WorkerModel {
  constructor({ id, started_at, heartbeat_at, status }) {
    this.id = id;
    this.started_at = started_at;
    this.heartbeat_at = heartbeat_at;
    this.status = status;
  }
}
