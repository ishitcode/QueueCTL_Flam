// src/workers/worker.js
import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import db from '../db.js';
import JobService from '../services/JobService.js';
import Config from '../services/ConfigService.js';

db.init();

const workerId = workerData.id;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runLoop() {
  const pollMs = Number(Config.get('poll_interval'));
  const jobTimeoutMs = Number(Config.get('job_timeout_ms'));
  const backoffBase = Number(Config.get('backoff_base'));

  let stopping = false;

  process.on('SIGTERM', () => (stopping = true));
  process.on('SIGINT', () => (stopping = true));

  while (true) {
    parentPort?.postMessage({ type: 'heartbeat', status: stopping ? 'stopping' : 'running' });

    if (stopping || Config.shutdownFlag()) break;

    const job = JobService.claimNext(workerId);
    if (!job) {
      await sleep(pollMs);
      continue;
    }

    // Execute job.command
    try {
      const { code, output } = await execShell(job.command, jobTimeoutMs);
      if (code === 0) {
        JobService.handleSuccess(job.id);
      } else {
        JobService.handleFailure(job, code, output, backoffBase);
      }
    } catch (err) {
      JobService.handleFailure(job, 1, String(err?.message || err), backoffBase);
    }
  }

  parentPort?.postMessage({ type: 'heartbeat', status: 'stopped' });
}

function execShell(command, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, { shell: true });

    let output = '';
    child.stdout.on('data', (d) => (output += d.toString()));
    child.stderr.on('data', (d) => (output += d.toString()));

    let killedByTimeout = false;
    let timer = null;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        killedByTimeout = true;
        child.kill('SIGKILL');
      }, timeoutMs);
    }

    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killedByTimeout) {
        resolve({ code: 124, output: `Timeout after ${timeoutMs}ms\n${output}` });
      } else {
        resolve({ code: code ?? 1, output });
      }
    });

    child.on('error', (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: 127, output: `Spawn error: ${err.message}` }); // not found or similar
    });
  });
}

runLoop().catch((e) => {
  // If worker crashes, just exit.
  console.error('Worker loop error:', e);
  process.exit(1);
});
