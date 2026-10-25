import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';
import { publicLab } from '../server/modules/labs/repository.js';
import { progress } from '../server/modules/progress/repository.js';
import { currentCheckpoint } from '../src/features/staff/progressSummary.js';

test('staff sees the viewed checkpoint or next unverified checkpoint without changing completion', () => {
  const db = createDatabase(':memory:');
  try {
    seed(db);
    const lab = publicLab(db, 'demo-publication');
    const student = progress(db, lab.id, 'student-1');
    const completions = structuredClone(student.completions);
    student.currentBlockId = 'density';
    assert.equal(currentCheckpoint(lab, student)?.id, 'density-check');
    student.currentBlockId = 'discussion';
    assert.equal(currentCheckpoint(lab, student)?.id, 'discussion');
    assert.deepEqual(student.completions, completions);
    student.currentBlockId = 'intro';
    student.completions = lab.blocks
      .filter((b) => b.type === 'checkpoint')
      .map((b) => ({
        blockId: b.id,
        method: 'ta' as const,
        verifiedAt: new Date().toISOString(),
      }));
    assert.equal(currentCheckpoint(lab, student), undefined);
  } finally {
    db.close();
  }
});
