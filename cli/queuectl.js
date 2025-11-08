#!/usr/bin/env node
// cli/queuectl.js
import { Command } from 'commander';
import db from '../src/db.js';
import JobService from '../src/services/JobService.js';
import WorkerService from '../src/services/WorkerService.js';
import Config from '../src/services/ConfigService.js';

db.init();

const program = new Command();
program
  .name('queuectl')
  .description('CLI background job queue with workers, retries, and DLQ (Node.js)')
  .version('1.0.0');

program
  .command('enqueue')
  .description('Enqueue a job. You can provide a JSON string, use --command to pass the shell command, or --file to read a JSON file')
  .argument('[jobJson]', 'JSON string for the job ({ "id"?, "command": "...", "max_retries"?: n })')
  .option('-c, --command <cmd>', 'Shell command to run for the job (easier on PowerShell)')
  .option('-f, --file <path>', 'Path to a JSON file containing the job payload')
  .action(async (jobJson, opts) => {
    try {
      let payload = null;
      if (opts.file) {
        // Lazy import so CLI stays lightweight
        const fs = await import('node:fs');
        const raw = fs.readFileSync(opts.file, 'utf8');
        payload = JSON.parse(raw);
      } else if (opts.command) {
        payload = { command: opts.command };
      } else if (jobJson) {
        payload = JSON.parse(jobJson);
      } else {
        throw new Error('Provide job JSON, or use --command / --file');
      }

      const id = JobService.enqueue(payload);
      console.log(id);
    } catch (err) {
      console.error('Failed to enqueue job:', err.message || err);
      process.exit(1);
    }
  });

program
  .command('worker')
  .description('Start/stop workers')
  .command('start')
  .option('--count <n>', 'number of workers', '1')
  .action((opts) => {
    const ids = WorkerService.start(Number(opts.count));
    console.log('started:', ids.join(', '));
  });

program
  .command('worker:stop')
  .description('Gracefully stop workers (set shutdown flag)')
  .action(() => {
    WorkerService.stopGracefully();
    console.log('Requested graceful shutdown. Workers will stop after finishing current job.');
  });

program
  .command('status')
  .description('Show job counts and worker status')
  .action(() => {
    console.log(JSON.stringify(JobService.status(), null, 2));
  });

program
  .command('list')
  .option('--state <state>', 'pending|processing|completed|failed|dead')
  .option('--limit <n>', 'limit rows')
  .action((opts) => {
    const rows = JobService.list({ state: opts.state, limit: opts.limit });
    rows.forEach((r) => console.log(JSON.stringify(r)));
  });

program
  .command('dlq:list')
  .action(() => {
    JobService.dlqList().forEach((r) => console.log(JSON.stringify(r)));
  });

program
  .command('dlq:retry')
  .argument('<jobId>')
  .action((jobId) => {
    JobService.dlqRetry(jobId);
    console.log(`Job ${jobId} moved from DLQ to pending.`);
  });

const cfg = program.command('config').description('Manage configuration');
cfg
  .command('get')
  .argument('<key>')
  .action((key) => {
    console.log(Config.get(key));
  });
cfg
  .command('set')
  .argument('<key>')
  .argument('<value>')
  .action((key, value) => {
    Config.set(key, value);
    console.log(`${key}=${value}`);
  });

program.parse(process.argv);
