import JobService from '../src/services/JobService.js';

(async function(){
  try {
    const id = JobService.enqueue({ command: 'echo hello from job1' });
    console.log('enqueued', id);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
