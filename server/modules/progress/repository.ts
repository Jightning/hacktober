import type { DB } from '../../db/database.js';
import type { StudentProgress, QueueRequest } from '../../../shared/contracts.js';
import { identity } from '../sessions/auth.js';
import { requireValue } from '../../http.js';
export function requests(db: DB, publicationId: string, studentId?: string): QueueRequest[] {
  const rows = db
    .prepare(
      `SELECT r.*,u.name,u.demo FROM requests r JOIN users u ON u.id = r.student_id WHERE publication_id = ? ${studentId ? 'AND student_id = ?' : ''} ORDER BY created_at,id`,
    )
    .all(...(studentId ? [publicationId, studentId] : [publicationId])) as any[];
  return rows.map((r) => ({
    id: r.id,
    studentId: r.student_id,
    studentName: r.name,
    demo: Boolean(r.demo),
    type: r.type,
    blockId: r.block_id,
    description: r.description,
    state: r.state,
    claimedBy: r.claimed_by,
    createdAt: r.created_at,
  }));
}
export function progress(db: DB, publicationId: string, studentId: string): StudentProgress {
  const enrollment = db
    .prepare('SELECT current_block_id FROM enrollments WHERE publication_id = ? AND student_id = ?')
    .get(publicationId, studentId) as any;
  requireValue(enrollment, 404, 'Student not enrolled in this lab.');
  const answers = (
    db
      .prepare('SELECT * FROM answers WHERE publication_id = ? AND student_id = ?')
      .all(publicationId, studentId) as any[]
  ).map((a) => ({
    blockId: a.block_id,
    value: a.value,
    units: a.units,
    submittedAt: a.submitted_at,
  }));
  const completions = (
    db
      .prepare('SELECT * FROM completions WHERE publication_id = ? AND student_id = ?')
      .all(publicationId, studentId) as any[]
  ).map((c) => ({ blockId: c.block_id, method: c.method, verifiedAt: c.verified_at }));
  return {
    student: identity(db.prepare('SELECT * FROM users WHERE id = ?').get(studentId)),
    currentBlockId: enrollment.current_block_id,
    answers,
    completions,
    requests: requests(db, publicationId, studentId),
  };
}
export function verify(
  db: DB,
  publicationId: string,
  studentId: string,
  blockId: string,
  method: 'automatic' | 'ta',
  staffId: string | null = null,
) {
  db.prepare('INSERT OR REPLACE INTO completions VALUES (?, ?, ?, ?, ?, ?)').run(
    publicationId,
    studentId,
    blockId,
    method,
    new Date().toISOString(),
    staffId,
  );
}
