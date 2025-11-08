// src/routes/workers.js
import { Router } from 'express';
import WorkerService from '../src/services/WorkerService.js';
import JobService from '../src/services/JobService.js';

const router = Router();

/** POST /workers/start?count=3 */
router.post('/start', (req, res, next) => {
  try {
    const count = Number(req.query.count || 1);
    const ids = WorkerService.start(count);
    res.json({ started: ids });
  } catch (e) {
    next(e);
  }
});

/** POST /workers/stop */
router.post('/stop', (req, res, next) => {
  try {
    WorkerService.stopGracefully();
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

/** GET /workers/status -> same as /jobs/status (includes workers) */
router.get('/status', (req, res, next) => {
  try {
    res.json(JobService.status());
  } catch (e) {
    next(e);
  }
});

export default router;
