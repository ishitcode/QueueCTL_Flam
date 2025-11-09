// src/routes/config.js
import { Router } from 'express';
import Config from '../src/services/ConfigService.js';

const router = Router();

/** GET /config */
router.get('/', (req, res, next) => {
  try {
    res.json(Config.getAll());
  } catch (e) {
    next(e);
  }
});

/** GET /config/:key */
router.get('/:key', (req, res, next) => {
  try {
    res.json({ key: req.params.key, value: Config.get(req.params.key) });
  } catch (e) {
    next(e);
  }
});

/** PUT /config/:key { value } */
router.put('/:key', (req, res, next) => {
  try {
    Config.set(req.params.key, req.body?.value ?? '');
    res.json({ key: req.params.key, value: String(req.body?.value ?? '') });
  } catch (e) {
    next(e);
  }
});

export default router;
