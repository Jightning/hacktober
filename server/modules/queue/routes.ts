import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { DB } from '../../db/database.js';
import { transaction } from '../../db/database.js';
import { user, staffAccess, studentAccess } from '../sessions/auth.js';
import { getPublication } from '../labs/repository.js';
import { requireValue, HttpError } from '../../http.js';
import { progress, verify } from '../progress/repository.js';
import { overview } from './overview.js';
export function queueRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  r.get<Record<string, string>>('/staff', (req, res) => {
    const id = String(req.params.id);
    staffAccess(db, id, user(db, req));
    res.json(overview(db, id));
  });
  r.post<Record<string, string>>('/queue', (req, res) => {
    const id = String(req.params.id);
    const u = user(db, req);
    studentAccess(db, id, u);
    const input = z
      .object({
        type: z.enum(['help', 'checkoff']),
        blockId: z.string(),
        description: z.string().trim().min(1).max(1000),
      })
      .parse(req.body);
    const draft = getPublication(db, id).draft;
    const now = new Date().toISOString();
    requireValue(
      now >= draft.settings.opensAt && now <= draft.settings.closesAt,
      403,
      'The lab session is closed. You can still view saved work.',
    );
    const block = draft.blocks.find((b) => b.id === input.blockId);
    requireValue(block, 400, 'Unknown block.');
    if (input.type === 'checkoff') {
      requireValue(
        block.type === 'checkpoint' && block.mode === 'ta',
        400,
        'Choose a TA checkpoint for a checkoff.',
      );
      const work = progress(db, id, u.id);
      requireValue(
        block.answerIds.every((answerId) => work.answers.some((a) => a.blockId === answerId)),
        400,
        'Submit the referenced answers before requesting a checkoff.',
      );
      requireValue(
        !work.completions.some((c) => c.blockId === block.id),
        409,
        'This checkpoint is already verified.',
      );
    }
    const requestId = randomUUID();
    try {
      db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)').run(
        requestId,
        id,
        u.id,
        input.type,
        input.blockId,
        input.description,
        'waiting',
        now,
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes('UNIQUE'))
        throw new HttpError(409, 'You already have an active request.');
      throw e;
    }
    res.status(201).json({ id: requestId });
  });
  r.post<Record<string, string>>('/queue/:requestId/cancel', (req, res) => {
    const id = String(req.params.id);
    const u = user(db, req);
    studentAccess(db, id, u);
    const row = db
      .prepare('SELECT state FROM requests WHERE id = ? AND publication_id = ? AND student_id = ?')
      .get(String(req.params.requestId), id, u.id) as any;
    requireValue(row, 404, 'Request not found.');
    requireValue(row.state === 'waiting', 409, 'Only a waiting request can be cancelled.');
    db.prepare("UPDATE requests SET state = 'cancelled' WHERE id = ? AND state = 'waiting'").run(
      String(req.params.requestId),
    );
    res.json({ ok: true });
  });
  r.post<Record<string, string>>('/queue/:requestId/:action', (req, res) => {
    const id = String(req.params.id);
    const u = user(db, req);
    staffAccess(db, id, u);
    const requestId = String(req.params.requestId);
    const action = z.enum(['claim', 'release', 'resolve', 'approve']).parse(req.params.action);
    transaction(db, () => {
      if (action === 'claim') {
        const result = db
          .prepare(
            "UPDATE requests SET state = 'claimed', claimed_by = ? WHERE id = ? AND publication_id = ? AND state = 'waiting'",
          )
          .run(u.id, requestId, id);
        requireValue(
          result.changes === 1,
          409,
          'Another TA already claimed this request, or it is no longer waiting.',
        );
        return;
      }
      const row = db
        .prepare('SELECT * FROM requests WHERE id = ? AND publication_id = ?')
        .get(requestId, id) as any;
      requireValue(row, 404, 'Request not found.');
      requireValue(
        row.state === 'claimed' && row.claimed_by === u.id,
        409,
        'Claim this request before acting on it.',
      );
      if (action === 'approve') {
        const block = getPublication(db, id).draft.blocks.find((b) => b.id === row.block_id);
        requireValue(
          row.type === 'checkoff' && block?.type === 'checkpoint' && block.mode === 'ta',
          400,
          'This is not a TA checkoff request.',
        );
        const work = progress(db, id, row.student_id);
        requireValue(
          block.answerIds.every((answerId) => work.answers.some((a) => a.blockId === answerId)),
          400,
          'The required answers have not been submitted.',
        );
        verify(db, id, row.student_id, block.id, 'ta', u.id);
      } else
        db.prepare('UPDATE requests SET state = ?, claimed_by = ? WHERE id = ?').run(
          action === 'release' ? 'waiting' : 'resolved',
          action === 'release' ? null : u.id,
          requestId,
        );
    });
    res.json({ ok: true });
  });
  return r;
}
