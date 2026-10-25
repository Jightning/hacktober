import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DB } from '../../db/database.js';
import { currentUser, identity, issueSession } from './auth.js';
import { requireValue } from '../../http.js';
import { publicLab } from '../labs/repository.js';
export function sessionRoutes(db: DB, demoAuth: boolean) {
  const r = Router();
  r.get('/session', (req, res) => res.json(currentUser(db, req)));
  r.get('/demo-identities', (_req, res) =>
    res.json(
      demoAuth
        ? db.prepare('SELECT * FROM users WHERE demo = 1 ORDER BY role,name').all().map(identity)
        : [],
    ),
  );
  r.post('/session/demo', (req, res) => {
    requireValue(demoAuth, 403, 'Demo authentication is disabled.');
    const { id } = z.object({ id: z.string() }).parse(req.body);
    const row = db.prepare('SELECT * FROM users WHERE id = ? AND demo = 1').get(id);
    requireValue(row, 400, 'Unknown demo identity.');
    issueSession(db, req, res, id);
    res.json(identity(row));
  });
  r.post('/session/logout', (req, res) => {
    const token = req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('labmate='))
      ?.slice(8);
    if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    res.clearCookie('labmate', { path: '/' });
    res.json({ ok: true });
  });
  r.get('/invitations/:id', (req, res) => {
    const lab = publicLab(db, req.params.id);
    res.json({ id: lab.id, title: lab.title, settings: lab.settings });
  });
  r.post('/join', (req, res) => {
    const { publicationId, name } = z
      .object({ publicationId: z.string(), name: z.string().trim().min(1).max(80) })
      .parse(req.body);
    publicLab(db, publicationId);
    const existing = currentUser(db, req);
    if (existing?.role === 'student') {
      db.prepare('INSERT OR IGNORE INTO enrollments VALUES (?, ?, NULL)').run(
        publicationId,
        existing.id,
      );
      return res.json(existing);
    }
    const id = randomUUID();
    db.prepare('INSERT INTO users VALUES (?, ?, ?, 0)').run(id, name, 'student');
    db.prepare('INSERT INTO enrollments VALUES (?, ?, NULL)').run(publicationId, id);
    issueSession(db, req, res, id);
    res.json({ id, name, role: 'student', demo: false });
  });
  return r;
}
