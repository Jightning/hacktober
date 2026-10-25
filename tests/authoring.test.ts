import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';
import type { Draft } from '../server/modules/labs/model.js';
import { validateDraft } from '../src/features/authoring/validation.js';

for (const scenario of ['reference', 'units', 'window', 'required'] as const) {
  test(`invalid ${scenario} identifies a field and cannot publish`, async () => {
    const db = createDatabase(':memory:');
    try {
      seed(db);
      const teacher = request.agent(createApp(db, { demoAuth: true, mockAI: true }));
      await teacher.post('/api/session/demo').send({ id: 'teacher-1' }).expect(200);
      const draft: Draft = (await teacher.get('/api/labs/demo-lab').expect(200)).body;
      const checkpoint = draft.blocks.find((b) => b.id === 'density-check')!;
      assert.equal(checkpoint.type, 'checkpoint');
      if (checkpoint.type !== 'checkpoint') throw Error('fixture');
      if (scenario === 'reference') checkpoint.answerIds = ['missing'];
      if (scenario === 'units' && checkpoint.rule?.kind === 'numeric') checkpoint.rule.units = 'kg';
      if (scenario === 'window') draft.settings.closesAt = draft.settings.opensAt;
      if (scenario === 'required')
        for (const b of draft.blocks) if (b.type === 'checkpoint') b.required = false;
      assert.ok(validateDraft(draft, true).length);
      const before = db.prepare('SELECT COUNT(*) AS count FROM publications').get();
      await teacher
        .put('/api/labs/demo-lab')
        .send(draft)
        .expect(scenario === 'required' ? 200 : 400);
      // Exercise publish validation independently of the valid-draft save boundary.
      db.prepare('UPDATE labs SET draft = ? WHERE id = ?').run(JSON.stringify(draft), 'demo-lab');
      await teacher.post('/api/labs/demo-lab/publish').send({}).expect(400);
      assert.deepEqual(db.prepare('SELECT COUNT(*) AS count FROM publications').get(), before);
    } finally {
      db.close();
    }
  });
}

test('new snapshots preserve earlier content, settings and student work; all demo staff assigned', async () => {
  const db = createDatabase(':memory:');
  try {
    seed(db);
    const app = createApp(db, { demoAuth: true, mockAI: true });
    const teacher = request.agent(app);
    const student = request.agent(app);
    await teacher.post('/api/session/demo').send({ id: 'teacher-1' }).expect(200);
    const a = (await teacher.post('/api/labs/demo-lab/publish').send({}).expect(201)).body.id;
    await student
      .post('/api/join')
      .send({ publicationId: a, name: 'Snapshot student' })
      .expect(200);
    await student
      .put(`/api/publications/${a}/answers/density`)
      .send({ value: '2.5', units: 'g/mL' })
      .expect(200);
    await student.post(`/api/publications/${a}/checks/density-check`).send({}).expect(200);
    const before = (await student.get(`/api/publications/${a}/student`).expect(200)).body;
    const snapshot = db.prepare('SELECT snapshot FROM publications WHERE id = ?').get(a);
    const draft: Draft = (await teacher.get('/api/labs/demo-lab').expect(200)).body;
    draft.title = 'Snapshot B';
    draft.settings.studentAI = false;
    draft.settings.taAI = false;
    draft.settings.hintPolicy = 'step';
    draft.blocks[0].title = 'Edited instructions';
    await teacher.put('/api/labs/demo-lab').send(draft).expect(200);
    const b = (await teacher.post('/api/labs/demo-lab/publish').send({}).expect(201)).body.id;
    assert.notEqual(a, b);
    assert.deepEqual(db.prepare('SELECT snapshot FROM publications WHERE id = ?').get(a), snapshot);
    assert.deepEqual(
      (await student.get(`/api/publications/${a}/student`).expect(200)).body,
      before,
    );
    const row = db.prepare('SELECT snapshot FROM publications WHERE id = ?').get(b) as {
      snapshot: string;
    };
    assert.deepEqual(JSON.parse(row.snapshot), draft);
    for (const id of ['ta-1', 'ta-2', 'teacher-1']) {
      const staff = request.agent(app);
      await staff.post('/api/session/demo').send({ id }).expect(200);
      await staff.get(`/api/publications/${b}/staff`).expect(200);
    }
    assert.doesNotMatch(JSON.stringify(before.lab), /rubric|expected|tolerance|instructorNotes/);
  } finally {
    db.close();
  }
});

test('local validation locates hidden image, numeric and session fields without changing entered values', async () => {
  const db = createDatabase(':memory:');
  try {
    seed(db);
    const row = db.prepare('SELECT draft FROM labs WHERE id = ?').get('demo-lab') as {
      draft: string;
    };
    const draft: Draft = JSON.parse(row.draft);
    draft.blocks.push({
      id: 'image',
      type: 'image',
      title: 'Photo',
      url: 'file:///private',
      alt: ' ',
    });
    const checkpoint = draft.blocks.find((b) => b.id === 'density-check')!;
    assert.equal(checkpoint.rule?.kind, 'numeric');
    if (checkpoint.rule?.kind !== 'numeric') throw Error('fixture');
    checkpoint.rule.expected = NaN;
    checkpoint.rule.tolerance = NaN;
    draft.settings.opensAt = '';
    const before = structuredClone(draft);
    const issues = validateDraft(draft);
    assert.ok(issues.some((i) => i.blockId === 'image' && i.field === 'alt'));
    assert.ok(issues.some((i) => i.blockId === 'image' && i.field === 'url'));
    assert.ok(issues.some((i) => i.blockId === checkpoint.id && i.field === 'expected'));
    assert.ok(issues.some((i) => i.blockId === checkpoint.id && i.field === 'tolerance'));
    assert.ok(issues.some((i) => i.page === 'Settings'));
    assert.deepEqual(draft, before);
  } finally {
    db.close();
  }
});
