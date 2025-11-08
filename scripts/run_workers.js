#!/usr/bin/env node
import db from '../src/db.js';
import WorkerService from '../src/services/WorkerService.js';

db.init();

const fs = await import('node:fs');
const args = process.argv.slice(2);
let count = 1;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--count' || args[i] === '-c') && args[i+1]) {
    count = Number(args[i+1]);
  }
}

const PID_FILE = './run_workers.pid';
// Prevent multiple runner instances
try {
  if (fs.existsSync(PID_FILE)) {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8')) || 0;
    try {
      process.kill(pid, 0);
      console.error(`Another run_workers process (pid=${pid}) appears to be running. Refusing to start.`);
      process.exit(1);
    } catch (e) {
      // stale pid file, continue
      fs.unlinkSync(PID_FILE);
    }
  }
  fs.writeFileSync(PID_FILE, String(process.pid), 'utf8');
} catch (e) {
  // ignore pid file errors
}

console.log(`Starting ${count} workers (persistent runner). Press Ctrl+C to stop.`);
WorkerService.start(count);

process.on('SIGINT', () => {
  try { fs.unlinkSync(PID_FILE); } catch (e) {}
  process.exit(0);
});

// Keep process alive
setInterval(() => {}, 1000);
