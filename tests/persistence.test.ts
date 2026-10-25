import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDatabase } from '../server/db/database.js';
import { seed, resetDemo } from '../server/db/seed.js';
import { progress } from '../server/modules/progress/repository.js';

test('SQLite survives reopen; seed is idempotent and reset preserves other labs', () => {
  const directory = mkdtempSync(join(tmpdir(), 'labmate-test-'));
  const path = join(directory, 'test.sqlite');
  let db = createDatabase(path);
  try {
    seed(db);
    db.prepare('INSERT INTO answers VALUES (?, ?, ?, ?, ?, ?)').run(
      'demo-publication',
      'student-1',
      'density',
      '2.5',
      'g/mL',
      new Date().toISOString(),
    );
    seed(db);
    db.close();
    db = createDatabase(path);
    assert.equal(progress(db, 'demo-publication', 'student-1').answers[0].value, '2.5');
    db.prepare('INSERT INTO labs VALUES (?, ?, ?)').run('other-lab', 'teacher-1', '{}');
    resetDemo(db);
    assert.ok(db.prepare('SELECT 1 FROM labs WHERE id = ?').get('other-lab'));
    assert.equal(progress(db, 'demo-publication', 'student-1').answers.length, 0);
    assert.equal(db.prepare('SELECT count(*) AS count FROM users WHERE demo = 1').get()?.count, 7);
  } finally {
    db.close();
    rmSync(directory, { recursive: true });
  }
});
