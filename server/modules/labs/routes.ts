import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DB } from '../../db/database.js';
import { transaction } from '../../db/database.js';
import { teacher, user } from '../sessions/auth.js';
import { requireValue } from '../../http.js';
import { draftSchema, type Draft } from './model.js';
export function labRoutes(db: DB) {
  const r = Router();
  function owned(id: string, owner: string) {
    const row = db
      .prepare('SELECT draft FROM labs WHERE id = ? AND owner_id = ?')
      .get(id, owner) as { draft: string } | undefined;
    requireValue(row, 404, 'Draft not found.');
    return JSON.parse(row.draft) as Draft;
  }
  r.get('/publications', (req, res) => {
    const u = user(db, req);
    const table = u.role === 'student' ? 'enrollments' : 'assignments';
    const col = u.role === 'student' ? 'student_id' : 'user_id';
    const rows = db
      .prepare(
        `SELECT p.id,p.snapshot,p.published_at FROM publications p JOIN ${table} a ON a.publication_id = p.id WHERE a.${col} = ? ORDER BY p.published_at DESC`,
      )
      .all(u.id) as any[];
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: JSON.parse(row.snapshot).title,
        publishedAt: row.published_at,
      })),
    );
  });
  r.get('/labs', (req, res) => {
    const u = teacher(db, req);
    res.json(
      (db.prepare('SELECT id,draft FROM labs WHERE owner_id = ?').all(u.id) as any[]).map(
        (row) => ({ id: row.id, title: JSON.parse(row.draft).title }),
      ),
    );
  });
  r.post('/labs', (req, res) => {
    const u = teacher(db, req);
    const { title } = z.object({ title: z.string().trim().min(1).max(200) }).parse(req.body);
    const id = randomUUID();
    const draft: Draft = {
      title,
      blocks: [
        {
          id: randomUUID(),
          title: 'Instructions',
          type: 'markdown',
          text: 'Describe the lab here.',
        },
      ],
      settings: {
        studentAI: true,
        taAI: true,
        hintPolicy: 'conceptual',
        opensAt: new Date(Date.now() - 60000).toISOString(),
        closesAt: new Date(Date.now() + 3 * 3600000).toISOString(),
      },
    };
    db.prepare('INSERT INTO labs VALUES (?, ?, ?)').run(id, u.id, JSON.stringify(draft));
    res.status(201).json({ id });
  });
  r.get('/labs/:id', (req, res) => res.json(owned(req.params.id, teacher(db, req).id)));
  r.put('/labs/:id', (req, res) => {
    owned(req.params.id, teacher(db, req).id);
    const draft = draftSchema.parse(req.body);
    db.prepare('UPDATE labs SET draft = ? WHERE id = ?').run(JSON.stringify(draft), req.params.id);
    res.json({ ok: true });
  });
  r.post('/labs/:id/publish', (req, res) => {
    const u = teacher(db, req);
    const draft = draftSchema.parse(owned(req.params.id, u.id));
    requireValue(
      draft.blocks.some((b) => b.type === 'checkpoint' && b.required),
      400,
      'Add at least one required checkpoint before publishing.',
    );
    const id = randomUUID();
    const publishedAt = new Date().toISOString();
    transaction(db, () => {
      db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?)').run(
        id,
        req.params.id,
        JSON.stringify(draft),
        publishedAt,
      );
      // Demo scope: all seeded TAs are explicitly assigned to each new publication.
      const tas = db.prepare("SELECT id FROM users WHERE role = 'ta' AND demo = 1").all() as {
        id: string;
      }[];
      for (const staffId of [u.id, ...tas.map((ta) => ta.id)])
        db.prepare('INSERT INTO assignments VALUES (?, ?)').run(id, staffId);
    });
    res.status(201).json({ id, title: draft.title, publishedAt });
  });
  return r;
}
