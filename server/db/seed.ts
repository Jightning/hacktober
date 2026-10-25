import type { DB } from './database.js';
import { transaction } from './database.js';
import { demoLab } from './fixture.js';
export function seed(db: DB) {
  if (db.prepare('SELECT 1 FROM labs WHERE id = ?').get('demo-lab')) return;
  transaction(db, () => {
    for (const [id, name, role] of [
      ['teacher-1', 'Dr. Morgan', 'teacher'],
      ['ta-1', 'Alex (TA)', 'ta'],
      ['ta-2', 'Sam (TA)', 'ta'],
      ['student-1', 'Jamie', 'student'],
      ['student-2', 'Priya', 'student'],
      ['student-3', 'Noah', 'student'],
      ['student-4', 'Riley', 'student'],
    ])
      db.prepare('INSERT OR IGNORE INTO users VALUES (?, ?, ?, 1)').run(id!, name!, role!);
    const snapshot = JSON.stringify(demoLab());
    const now = new Date().toISOString();
    db.prepare('INSERT INTO labs VALUES (?, ?, ?)').run('demo-lab', 'teacher-1', snapshot);
    db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?)').run(
      'demo-publication',
      'demo-lab',
      snapshot,
      now,
    );
    for (const id of ['teacher-1', 'ta-1', 'ta-2'])
      db.prepare('INSERT INTO assignments VALUES (?, ?)').run('demo-publication', id);
    for (const [id, block] of [
      ['student-1', 'intro'],
      ['student-2', 'density'],
      ['student-3', 'discussion'],
      ['student-4', 'discussion'],
    ])
      db.prepare('INSERT INTO enrollments VALUES (?, ?, ?)').run('demo-publication', id!, block!);
    for (const [id, value] of [
      ['student-2', '0.4'],
      ['student-3', '2.5'],
      ['student-4', '2.5'],
    ])
      db.prepare('INSERT INTO answers VALUES (?, ?, ?, ?, ?, ?)').run(
        'demo-publication',
        id!,
        'density',
        value!,
        'g/mL',
        now,
      );
    for (const id of ['student-3', 'student-4'])
      db.prepare('INSERT INTO completions VALUES (?, ?, ?, ?, ?, NULL)').run(
        'demo-publication',
        id,
        'density-check',
        'automatic',
        now,
      );
    db.prepare('INSERT INTO completions VALUES (?, ?, ?, ?, ?, ?)').run(
      'demo-publication',
      'student-4',
      'discussion',
      'ta',
      now,
      'ta-2',
    );
    db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)').run(
      'demo-help',
      'demo-publication',
      'student-2',
      'help',
      'density',
      'I am unsure which quantity goes on top.',
      'waiting',
      new Date(Date.now() - 240000).toISOString(),
    );
    db.prepare('INSERT INTO requests VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)').run(
      'demo-checkoff',
      'demo-publication',
      'student-3',
      'checkoff',
      'discussion',
      'Ready to explain my calculation.',
      'waiting',
      new Date(Date.now() - 120000).toISOString(),
    );
  });
}
/** Removes only the reserved demo lab and its activity; preserves other authored labs. */
export function resetDemo(db: DB) {
  transaction(db, () => {
    const ids = db.prepare('SELECT id FROM publications WHERE lab_id = ?').all('demo-lab') as {
      id: string;
    }[];
    for (const { id } of ids) {
      for (const table of [
        'messages',
        'requests',
        'completions',
        'answers',
        'enrollments',
        'assignments',
      ])
        db.prepare(`DELETE FROM ${table} WHERE publication_id = ?`).run(id);
    }
    db.prepare('DELETE FROM publications WHERE lab_id = ?').run('demo-lab');
    db.prepare('DELETE FROM labs WHERE id = ?').run('demo-lab');
  });
  seed(db);
}
