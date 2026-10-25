import express from 'express';
import type { DB } from './db/database.js';
import { errorHandler, requireValue } from './http.js';
import { sessionRoutes } from './modules/sessions/routes.js';
import { labRoutes } from './modules/labs/routes.js';
import { progressRoutes } from './modules/progress/routes.js';
import { queueRoutes } from './modules/queue/routes.js';
import { aiRoutes } from './modules/ai/routes.js';
export function createApp(db: DB, options: { demoAuth: boolean; mockAI: boolean }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '300kb' }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin) {
      const origin = new URL(req.headers.origin);
      requireValue(
        origin.host === req.headers.host ||
          (process.env.NODE_ENV !== 'production' &&
            ['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin.origin)),
        403,
        'Cross-origin request rejected.',
      );
    }
    next();
  });
  app.get('/api/health', (_req, res) =>
    res.json({
      ok: true,
      mockAI: options.mockAI,
      model: process.env.GEMINI_MODEL || 'gemma-4-26b-a4b-it',
    }),
  );
  app.use('/api', sessionRoutes(db, options.demoAuth), labRoutes(db));
  app.use(
    '/api/publications/:id',
    queueRoutes(db),
    aiRoutes(db, options.mockAI),
    progressRoutes(db),
  );
  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use(errorHandler);
  return app;
}
