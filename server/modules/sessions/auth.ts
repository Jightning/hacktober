import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import type { DB } from '../../db/database.js';
import type { Identity } from '../../../shared/contracts.js';
import { requireValue } from '../../http.js';
export function identity(row: any): Identity {
  return { id: row.id, name: row.name, role: row.role, demo: Boolean(row.demo) };
}
export function currentUser(db: DB, req: Request): Identity | null {
  const token = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('labmate='))
    ?.slice(8);
  if (!token) return null;
  const row = db
    .prepare(
      'SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id WHERE token = ? AND expires_at > ?',
    )
    .get(token, Date.now());
  return row ? identity(row) : null;
}
export function user(db: DB, req: Request): Identity {
  const u = currentUser(db, req);
  requireValue(u, 401, 'Join the lab or choose a demo identity first.');
  return u;
}
export function teacher(db: DB, req: Request) {
  const u = user(db, req);
  requireValue(u.role === 'teacher', 403, 'Teacher access required.');
  return u;
}
export function staffAccess(db: DB, publicationId: string, u: Identity) {
  requireValue(
    u.role !== 'student' &&
      db
        .prepare('SELECT 1 FROM assignments WHERE publication_id = ? AND user_id = ?')
        .get(publicationId, u.id),
    403,
    'This lab is not assigned to you.',
  );
}
export function studentAccess(db: DB, publicationId: string, u: Identity) {
  requireValue(
    u.role === 'student' &&
      db
        .prepare('SELECT 1 FROM enrollments WHERE publication_id = ? AND student_id = ?')
        .get(publicationId, u.id),
    403,
    'Join this lab with its student link first.',
  );
}
export function issueSession(db: DB, req: Request, res: Response, userId: string) {
  const old = req.headers.cookie
    ?.split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('labmate='))
    ?.slice(8);
  if (old) db.prepare('DELETE FROM sessions WHERE token = ?').run(old);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions VALUES (?, ?, ?)').run(token, userId, Date.now() + 7 * 86400000);
  res.cookie('labmate', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 86400000,
    path: '/',
  });
}
