#!/usr/bin/env node
import JobService from '../src/services/JobService.js';
import Config from '../src/services/ConfigService.js';

const POLL_MS = 1000;
const TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  const start = Date.now();
  console.log('Waiting for all jobs to reach a terminal state (completed or dead)...');

  while (true) {
    const st = JobService.status();
    const pending = (st.counts.pending || 0) + (st.counts.processing || 0);
    console.log(new Date().toISOString(), 'counts:', st.counts);
    if (pending === 0) {
      console.log('All jobs finished. Final status:');
      console.log(JSON.stringify(st, null, 2));
      console.log('\nDLQ entries:');
      const dlq = JobService.dlqList();
      dlq.forEach(d => console.log(d.id, d.command, d.attempts, d.last_error));
      process.exit(0);
    }
    if (Date.now() - start > TIMEOUT_MS) {
      console.error('Timed out waiting for jobs to complete.');
      process.exit(2);
    }
    await sleep(POLL_MS);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
