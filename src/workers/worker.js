// src/workers/worker.js
// This worker runs only the command assigned by the main thread.
// It expects messages: { type: 'run', job: {...}, timeoutMs: number }
// and replies with { type: 'result', jobId, code, output }
import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';

const workerId = workerData?.id || 'worker';

function execShell(command, timeoutMs) {
  return new Promise((resolve) => {
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
      resolve({ code: 127, output: `Spawn error: ${err.message}` });
    });
  });
}

parentPort.on('message', async (msg) => {
  try {
    if (msg?.type === 'run' && msg.job) {
      const { job, timeoutMs } = msg;
      const res = await execShell(job.command, timeoutMs || 0);
      parentPort.postMessage({ type: 'result', jobId: job.id, code: res.code, output: res.output, workerId });
    } else if (msg?.type === 'shutdown') {
      parentPort.postMessage({ type: 'stopped' });
      process.exit(0);
    }
  } catch (err) {
    parentPort.postMessage({ type: 'result', jobId: msg?.job?.id, code: 1, output: String(err?.message || err), workerId });
  }
});
