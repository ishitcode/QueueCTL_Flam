// test/verify_core_flows.js
import JobService from '../src/services/JobService.js';
import WorkerService from '../src/services/WorkerService.js';
import db from '../src/db.js';

console.log('🧪 QueueCTL Core Flow Test\n');
db.init();

// 1. enqueue test jobs
console.log('→ Enqueueing jobs...');
const job1 = JobService.enqueue({ command: 'echo success test' });
const job2 = JobService.enqueue({ command: 'notarealcommand' });
console.log('Jobs:', job1, job2);

// 2. start 2 workers
console.log('→ Starting workers...');
WorkerService.start(2);

// wait a bit, then print statuses
setTimeout(() => {
  console.log('\n→ Status after 10s:');
  console.log(JSON.stringify(JobService.status(), null, 2));
  process.exit(0);
}, 10000);
