// src/app.js
import express from 'express';
import morgan from 'morgan';
import jobs from './routes/jobs.js';
import workers from './routes/workers.js';
import config from './routes/config.js';

const app = express();
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (_req, res) => res.json({ name: 'queuectl', ok: true }));

app.use('/jobs', jobs);
app.use('/workers', workers);
app.use('/config', config);

// Error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(400).json({ error: String(err.message || err) });
});

export default app;
