import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../../db/database.js';
import type { ChatMessage } from '../../../shared/contracts.js';
import { transaction } from '../../db/database.js';
import { user, staffAccess, studentAccess } from '../sessions/auth.js';
import { getPublication } from '../labs/repository.js';
import { requireValue } from '../../http.js';
import { studentContext, staffContext } from './context.js';
import { generateReply } from './provider.js';
export function aiRoutes(db: DB, mockAI: boolean) {
  const r = Router({ mergeParams: true });
  const pending = new Set<string>();
  function scope(req: Parameters<typeof user>[1]) {
    const publicationId = String(req.params.id);
    const u = user(db, req);
    const audience: 'student' | 'staff' = u.role === 'student' ? 'student' : 'staff';
    const requested = req.method === 'GET' ? req.query.studentId : req.body.studentId;
    if (audience === 'student') {
      studentAccess(db, publicationId, u);
      requireValue(
        !requested || requested === u.id,
        403,
        'You can access only your own assistant.',
      );
    } else staffAccess(db, publicationId, u);
    const studentId = audience === 'student' ? u.id : z.string().min(1).parse(requested);
    requireValue(
      db
        .prepare('SELECT 1 FROM enrollments WHERE publication_id = ? AND student_id = ?')
        .get(publicationId, studentId),
      404,
      'Student not enrolled.',
    );
    return { publicationId, actorId: u.id, studentId, audience };
  }
  function history(s: ReturnType<typeof scope>): ChatMessage[] {
    return (
      db
        .prepare(
          'SELECT role,text,mock FROM messages WHERE publication_id = ? AND actor_id = ? AND student_id = ? AND audience = ? ORDER BY id DESC LIMIT 20',
        )
        .all(s.publicationId, s.actorId, s.studentId, s.audience) as any[]
    )
      .reverse()
      .map((m) => ({ role: m.role, text: m.text, mock: Boolean(m.mock) }));
  }
  r.get('/assistant', (req, res) => res.json(history(scope(req))));
  r.post('/assistant', async (req, res) => {
    const s = scope(req);
    const settings = getPublication(db, s.publicationId).draft.settings;
    requireValue(
      s.audience === 'student' ? settings.studentAI : settings.taAI,
      403,
      'The instructor has disabled this assistant.',
    );
    const { message } = z.object({ message: z.string().trim().min(1).max(2000) }).parse(req.body);
    const key = JSON.stringify(s);
    requireValue(!pending.has(key), 409, 'A response is already in progress.');
    pending.add(key);
    try {
      const context =
        s.audience === 'student'
          ? studentContext(db, s.publicationId, s.studentId)
          : staffContext(db, s.publicationId, s.studentId);
      const reply = await generateReply(
        {
          audience: s.audience,
          hintPolicy: settings.hintPolicy,
          context,
          history: history(s),
          message,
        },
        mockAI,
      );
      transaction(db, () => {
        const insert = db.prepare(
          'INSERT INTO messages (publication_id,actor_id,student_id,audience,role,text,mock) VALUES (?, ?, ?, ?, ?, ?, ?)',
        );
        insert.run(s.publicationId, s.actorId, s.studentId, s.audience, 'user', message, 0);
        insert.run(
          s.publicationId,
          s.actorId,
          s.studentId,
          s.audience,
          'assistant',
          reply.text,
          Number(reply.mock),
        );
      });
      res.json(reply);
    } finally {
      pending.delete(key);
    }
  });
  return r;
}
