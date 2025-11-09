// src/server.js
import app from './app.js';
import db from './db.js';

const PORT = process.env.PORT || 3000;

db.init();

app.listen(PORT, () => {
  console.log(`queuectl API listening on :${PORT}`);
});
