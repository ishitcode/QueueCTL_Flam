#!/usr/bin/env node
import db from '../src/db.js';

db.init();
const sql = db.get();

console.log('CONFIG:');
const cfg = sql.prepare('SELECT key, value FROM config').all();
console.table(cfg);

console.log('\nWORKERS:');
const workers = sql.prepare('SELECT * FROM workers').all();
console.table(workers);

console.log('\nJOBS (first 50):');
const jobs = sql.prepare('SELECT id, command, state, attempts, max_retries, created_at, updated_at, next_run_at, worker_id, last_error FROM jobs ORDER BY created_at LIMIT 50').all();
console.table(jobs);

console.log('\nCounts:');
const counts = sql.prepare("SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state").all();
console.table(counts);

process.exit(0);
