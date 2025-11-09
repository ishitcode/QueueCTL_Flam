// src/routes/jobs.js
import { Router } from 'express';
import JobService from '../src/services/JobService.js';

const router = Router();

/**
 * POST /jobs
 * body: { id?, command, max_retries? }
 */
router.post('/', (req, res, next) => {
  try {
    const id = JobService.enqueue(req.body || {});
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
});

/** GET /jobs?state=pending&limit=50 */
router.get('/', (req, res, next) => {
  try {
    const { state, limit } = req.query;
    const list = JobService.list({ state, limit });
    res.json(list);
  } catch (e) {
    next(e);
  }
});

/** GET /jobs/status */
router.get('/status', (req, res, next) => {
  try {
    res.json(JobService.status());
  } catch (e) {
    next(e);
  }
});

/** GET /jobs/dlq */
router.get('/dlq', (req, res, next) => {
  try {
    res.json(JobService.dlqList());
  } catch (e) {
    next(e);
  }
});

/** POST /jobs/dlq/:id/retry */
router.post('/dlq/:id/retry', (req, res, next) => {
  try {
    JobService.dlqRetry(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
