import 'dotenv/config';
import express from 'express';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { createDatabase } from './db/database.js';
import { createApp } from './app.js';
const db = createDatabase(process.env.DATABASE_PATH || './data/labmate.sqlite');
const app = createApp(db, {
  demoAuth: process.env.DEMO_AUTH === 'true',
  mockAI: process.env.AI_MOCK_MODE === 'true',
});
if (existsSync(resolve('dist/index.html'))) {
  app.use(express.static(resolve('dist')));
  app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
}
const port = Number(process.env.PORT || 3001);
app.listen(port, '127.0.0.1', () =>
  console.log(
    `LabMate API: http://127.0.0.1:${port} · AI: ${process.env.AI_MOCK_MODE === 'true' ? 'explicit mock mode' : 'live Gemma adapter'}`,
  ),
);
