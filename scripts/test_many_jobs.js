#!/usr/bin/env node
import db from '../src/db.js';
import JobService from '../src/services/JobService.js';
import Config from '../src/services/ConfigService.js';

db.init();

async function main() {
  console.log('Preparing test: enqueueing jobs...');

  // Make retries/backoff small for test speed
  Config.set('backoff_base', '2');
  Config.set('poll_interval', '500');

  const jobs = [];

  // 8 successful jobs
    for (let i = 0; i < 8; i++) {
      const id = JobService.enqueue({ command: `node -e "console.log('job ok ${i}')"}` });
      jobs.push({ id, expect: 'completed' });
  }

  // 4 failing jobs (node exits with code 1)
    for (let i = 0; i < 4; i++) {
      // failing jobs
      const id = JobService.enqueue({ command: `node -e "process.exit(1)"`, max_retries: 2 });
      jobs.push({ id, expect: 'dead' });
  }

  console.log('Enqueued', jobs.length, 'jobs. Waiting for processing...');

  const timeoutMs = 120000; // 2 minutes max
  const start = Date.now();

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  while (true) {
    const st = JobService.status();
    const pending = st.counts.pending + st.counts.processing;
    console.log(new Date().toISOString(), 'counts:', st.counts);
    if (pending === 0) break;
    if (Date.now() - start > timeoutMs) {
      console.error('Timed out waiting for jobs to finish');
      break;
    }
    await sleep(1000);
  }

  const final = JobService.status();
  console.log('Final counts:', final.counts);

  console.log('\nDLQ entries:');
  const dlq = JobService.dlqList();
  dlq.forEach(d => console.log(d.id, d.command, d.attempts, d.last_error));

  console.log('\nTest finished.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
