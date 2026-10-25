import { Router } from 'express';
import { z } from 'zod';
import type { DB } from '../../db/database.js';
import { transaction } from '../../db/database.js';
import { user, studentAccess } from '../sessions/auth.js';
import { getPublication, publicLab } from '../labs/repository.js';
import { requireValue } from '../../http.js';
import { progress, verify } from './repository.js';
import { validateAnswer } from './validation.js';
export function progressRoutes(db: DB) {
  const r = Router({ mergeParams: true });
  r.use((req, _res, next) => {
    studentAccess(db, String(req.params.id), user(db, req));
    next();
  });
  r.get<Record<string, string>>('/student', (req, res) =>
    res.json({
      lab: publicLab(db, String(req.params.id)),
      progress: progress(db, String(req.params.id), user(db, req).id),
    }),
  );
  r.post<Record<string, string>>('/visit', (req, res) => {
    const id = String(req.params.id);
    const { blockId } = z.object({ blockId: z.string() }).parse(req.body);
    requireValue(
      getPublication(db, id).draft.blocks.some((b) => b.id === blockId),
      400,
      'Unknown block.',
    );
    db.prepare(
      'UPDATE enrollments SET current_block_id = ? WHERE publication_id = ? AND student_id = ?',
    ).run(blockId, id, user(db, req).id);
    res.json({ ok: true });
  });
  r.put<Record<string, string>>('/answers/:blockId', (req, res) => {
    const id = String(req.params.id);
    const studentId = user(db, req).id;
    const blockId = String(req.params.blockId);
    const { value, units } = z
      .object({ value: z.string().trim().min(1).max(4000), units: z.string().max(50) })
      .parse(req.body);
    const draft = getPublication(db, id).draft;
    const block = draft.blocks.find((b) => b.id === blockId);
    requireValue(block?.type === 'answer', 400, 'This block is not an answer.');
    requireValue(
      block.input !== 'number' ||
        (Number.isFinite(Number(value)) &&
          /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)),
      400,
      'Enter a finite number.',
    );
    transaction(db, () => {
      const old = db
        .prepare(
          'SELECT value,units FROM answers WHERE publication_id = ? AND student_id = ? AND block_id = ?',
        )
        .get(id, studentId, blockId) as any;
      if (!old || old.value !== value || old.units !== units)
        for (const b of draft.blocks)
          if (b.type === 'checkpoint' && b.answerIds.includes(blockId))
            db.prepare(
              'DELETE FROM completions WHERE publication_id = ? AND student_id = ? AND block_id = ?',
            ).run(id, studentId, b.id);
      db.prepare('INSERT OR REPLACE INTO answers VALUES (?, ?, ?, ?, ?, ?)').run(
        id,
        studentId,
        blockId,
        value,
        units,
        new Date().toISOString(),
      );
    });
    res.json({ ok: true });
  });
  r.post<Record<string, string>>('/checks/:blockId', (req, res) => {
    const id = String(req.params.id);
    const studentId = user(db, req).id;
    const block = getPublication(db, id).draft.blocks.find((b) => b.id === req.params.blockId);
    requireValue(
      block?.type === 'checkpoint' && block.mode === 'automatic' && block.rule,
      400,
      'This checkpoint requires TA approval.',
    );
    const answer = progress(db, id, studentId).answers.find(
      (a) => a.blockId === block.answerIds[0],
    );
    const passed = Boolean(answer && validateAnswer(block.rule, answer.value, answer.units));
    if (passed) verify(db, id, studentId, block.id, 'automatic');
    res.json({
      passed,
      feedback: passed
        ? 'Verified.'
        : 'Not verified yet. Check your response and units, or ask for guidance.',
    });
  });
  return r;
}
