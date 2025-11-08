#!/usr/bin/env node
import db from '../src/db.js';

db.init();
const sql = db.get();

const mins = Number(process.argv[2] || 60);
const since = new Date(Date.now() - mins * 60 * 1000).toISOString();

console.log(`Counting jobs (total and created in the last ${mins} minutes since ${since})`);
const total = sql.prepare('SELECT state, COUNT(*) as cnt FROM jobs GROUP BY state').all();
console.table(total);

const recent = sql.prepare('SELECT state, COUNT(*) as cnt FROM jobs WHERE created_at >= ? GROUP BY state').all(since);
console.log('Recent:');
console.table(recent);

const totalRows = sql.prepare('SELECT COUNT(*) as c FROM jobs').get().c;
console.log('Total job rows in DB:', totalRows);

process.exit(0);
