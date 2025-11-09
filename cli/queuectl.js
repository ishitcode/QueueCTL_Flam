#!/usr/bin/env node
// cli/queuectl.js
// PowerShell-friendly CLI for QueueCTL (Node.js)
// Supports: enqueue, worker start/stop, status, list, dlq list/retry, config get/set

import { Command } from 'commander';
import path from 'node:path';
import fs from 'node:fs';

// NOTE: cli/ is at project root; src is next to it -> ../src/...
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

// ------------------ enqueue ------------------
program
  .command('enqueue')
  .description('Enqueue a job. Use --command (PowerShell-friendly) or --file for JSON payloads.')
  .argument('[jobJson]', 'JSON string for the job ({ "id"?, "command": "...", "max_retries"?: n })', null)
  .option('-c, --command <cmd>', 'Shell command to run for the job (easier on PowerShell)')
  .option('-f, --file <path>', 'Path to a JSON file containing the job payload')
  .action(async (jobJson, opts) => {
    try {
      let payload = null;
      if (opts.file) {
        const raw = fs.readFileSync(opts.file, 'utf8');
        payload = JSON.parse(raw);
      } else if (opts.command) {
        payload = { command: opts.command };
      } else if (jobJson) {
        // allow user to pass JSON string; must be properly escaped for PowerShell
        payload = JSON.parse(jobJson);
      } else {
        console.error('Please provide a job payload: --command "echo hi"  OR  --file job.json  OR  enqueue \'{ "command":"..." }\'');
        process.exit(2);
      }

      const id = JobService.enqueue(payload);
      console.log(id);
    } catch (err) {
      console.error('Failed to enqueue job:', (err && err.message) || err);
      process.exit(1);
    }
  });

// ------------------ worker (subcommands) ------------------
const worker = program.command('worker').description('Start/stop workers (foreground supervisor)');

worker
  .command('start')
  .description('Start one or more workers (foreground)')
  .option('--count <n>', 'number of workers', '1')
  .action((opts) => {
    const count = Number(opts.count || 1);
    if (Number.isNaN(count) || count <= 0) {
      console.error('Invalid --count value (must be a positive integer).');
      process.exit(2);
    }
    const ids = WorkerService.start(count);
    console.log('started:', ids.join(', '));
  });

worker
  .command('stop')
  .description('Request graceful stop for running workers')
  .action(() => {
    WorkerService.stopGracefully();
    console.log('Requested graceful shutdown. Workers will stop after finishing current job.');
  });

// ------------------ status ------------------
program
  .command('status')
  .description('Show job counts and worker status')
  .action(() => {
    try {
      const s = JobService.status();
      console.log(JSON.stringify(s, null, 2));
    } catch (err) {
      console.error('Failed to get status:', err.message || err);
      process.exit(1);
    }
  });

// ------------------ list ------------------
program
  .command('list')
  .description('List jobs (filter by state)')
  .option('--state <state>', 'pending|processing|completed|failed|dead')
  .option('--limit <n>', 'limit rows (default 50)', '50')
  .action((opts) => {
    try {
      const rows = JobService.list({ state: opts.state, limit: Number(opts.limit) || 50 });
      if (!rows || rows.length === 0) {
        console.log('No jobs found.');
        return;
      }
      rows.forEach((r) => console.log(JSON.stringify(r)));
    } catch (err) {
      console.error('Failed to list jobs:', err.message || err);
      process.exit(1);
    }
  });

// ------------------ dlq (subcommands) ------------------
const dlq = program.command('dlq').description('Dead Letter Queue (DLQ) management');

dlq
  .command('list')
  .description('List DLQ jobs')
  .action(() => {
    try {
      const jobs = JobService.dlqList();
      if (!jobs || jobs.length === 0) {
        console.log('No jobs in DLQ.');
        return;
      }
      jobs.forEach((j) => console.log(JSON.stringify(j)));
    } catch (err) {
      console.error('Failed to list DLQ:', err.message || err);
      process.exit(1);
    }
  });

dlq
  .command('retry')
  .argument('<jobId>', 'ID of job to retry from DLQ')
  .description('Retry a job from DLQ (move to pending)')
  .action((jobId) => {
    try {
      JobService.dlqRetry(jobId);
      console.log(`✅ Job ${jobId} moved from DLQ to pending.`);
    } catch (err) {
      console.error('Failed to retry DLQ job:', err.message || err);
      process.exit(1);
    }
  });

// ------------------ config ------------------
const cfg = program.command('config').description('Manage configuration (retry, backoff, etc.)');

cfg
  .command('get')
  .argument('<key>', 'Config key to get')
  .description('Get config value')
  .action((key) => {
    try {
      console.log(`${key} = ${Config.get(key)}`);
    } catch (err) {
      console.error('Failed to get config key:', err.message || err);
      process.exit(1);
    }
  });

cfg
  .command('set')
  .argument('<key>', 'Config key to set')
  .argument('<value>', 'New value')
  .description('Set config value')
  .action((key, value) => {
    try {
      Config.set(key, String(value));
      console.log(`✅ Config updated: ${key} = ${value}`);
    } catch (err) {
      console.error('Failed to set config key:', err.message || err);
      process.exit(1);
    }
  });

// ------------------ fallback/help ------------------
program.parse(process.argv);

// If no args, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
