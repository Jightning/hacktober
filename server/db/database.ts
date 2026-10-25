import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
export type DB = DatabaseSync;
export function createDatabase(path: string): DB {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS labs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), draft TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS publications (id TEXT PRIMARY KEY, lab_id TEXT NOT NULL REFERENCES labs(id), snapshot TEXT NOT NULL, published_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS assignments (publication_id TEXT REFERENCES publications(id), user_id TEXT REFERENCES users(id), PRIMARY KEY(publication_id,user_id));
    CREATE TABLE IF NOT EXISTS enrollments (publication_id TEXT REFERENCES publications(id), student_id TEXT REFERENCES users(id), current_block_id TEXT, PRIMARY KEY(publication_id,student_id));
    CREATE TABLE IF NOT EXISTS answers (publication_id TEXT, student_id TEXT, block_id TEXT, value TEXT NOT NULL, units TEXT NOT NULL, submitted_at TEXT NOT NULL, PRIMARY KEY(publication_id,student_id,block_id), FOREIGN KEY(publication_id,student_id) REFERENCES enrollments(publication_id,student_id));
    CREATE TABLE IF NOT EXISTS completions (publication_id TEXT, student_id TEXT, block_id TEXT, method TEXT NOT NULL, verified_at TEXT NOT NULL, approved_by TEXT REFERENCES users(id), PRIMARY KEY(publication_id,student_id,block_id), FOREIGN KEY(publication_id,student_id) REFERENCES enrollments(publication_id,student_id));
    CREATE TABLE IF NOT EXISTS requests (id TEXT PRIMARY KEY, publication_id TEXT NOT NULL, student_id TEXT NOT NULL, type TEXT NOT NULL, block_id TEXT NOT NULL, description TEXT NOT NULL, state TEXT NOT NULL, claimed_by TEXT REFERENCES users(id), created_at TEXT NOT NULL, FOREIGN KEY(publication_id,student_id) REFERENCES enrollments(publication_id,student_id));
    CREATE UNIQUE INDEX IF NOT EXISTS one_active_request ON requests(publication_id,student_id) WHERE state IN ('waiting','claimed');
    CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, publication_id TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES users(id), student_id TEXT NOT NULL REFERENCES users(id), audience TEXT NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, mock INTEGER NOT NULL);
  `);
  return db;
}
export function transaction<T>(db: DB, action: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = action();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
