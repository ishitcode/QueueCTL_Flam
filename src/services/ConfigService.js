// src/services/ConfigService.js
import db from '../db.js';

class ConfigService {
  get(key) {
    const row = db.get().prepare(`SELECT value FROM config WHERE key=?`).get(key);
    if (!row) throw new Error(`Config key not found: ${key}`);
    return row.value;
  }

  set(key, value) {
    db.get().prepare(`
      INSERT INTO config(key,value) VALUES(?,?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, String(value));
  }

  getAll() {
    return db.get().prepare(`SELECT key, value FROM config`).all();
  }

  shutdownFlag() {
    return this.get('shutdown') === '1';
  }

  setShutdown(flag) {
    this.set('shutdown', flag ? '1' : '0');
  }
}

export default new ConfigService();
