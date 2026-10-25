import type { DB } from '../../db/database.js';
import type { StaffState } from '../../../shared/contracts.js';
import { getPublication, publicLab } from '../labs/repository.js';
import { progress, requests } from '../progress/repository.js';
export function overview(db: DB, id: string): StaffState {
  const lab = publicLab(db, id);
  const draft = getPublication(db, id).draft;
  const students = (
    db.prepare('SELECT student_id FROM enrollments WHERE publication_id = ?').all(id) as {
      student_id: string;
    }[]
  ).map((row) => progress(db, id, row.student_id));
  const required = lab.blocks.filter((b) => b.type === 'checkpoint' && b.required);
  const instructorContext = Object.fromEntries(
    draft.blocks.map((b) => [
      b.id,
      [b.instructorNotes, b.rubric, b.rule ? `Validation criteria: ${JSON.stringify(b.rule)}` : '']
        .filter(Boolean)
        .join('\n'),
    ]),
  );
  return {
    lab,
    students,
    requests: requests(db, id).filter((r) => r.state === 'waiting' || r.state === 'claimed'),
    instructorContext,
    stats: {
      total: students.length,
      completed: students.filter((s) =>
        required.every((b) => s.completions.some((c) => c.blockId === b.id)),
      ).length,
      checkpoints: required.map((b) => ({
        id: b.id,
        title: b.title,
        verified: students.filter((s) => s.completions.some((c) => c.blockId === b.id)).length,
        total: students.length,
      })),
    },
  };
}
