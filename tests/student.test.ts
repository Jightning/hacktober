import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';
import type { Draft } from '../server/modules/labs/model.js';
import type { StudentState } from '../shared/contracts.js';

type Agent = ReturnType<typeof request.agent>;
async function login(agent: Agent, id: string) {
  await agent.post('/api/session/demo').send({ id }).expect(200);
}
async function state(agent: Agent, base: string): Promise<StudentState> {
  return (await agent.get(`${base}/student`).expect(200)).body;
}
async function fixture(t: TestContext) {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  seed(db);
  const app = createApp(db, { demoAuth: true, mockAI: true });
  const teacher = request.agent(app);
  const student = request.agent(app);
  const other = request.agent(app);
  const ta = request.agent(app);
  await Promise.all([
    login(teacher, 'teacher-1'),
    login(student, 'student-1'),
    login(other, 'student-2'),
    login(ta, 'ta-1'),
  ]);
  const draft: Draft = (await teacher.get('/api/labs/demo-lab').expect(200)).body;
  draft.blocks = ['a', 'b'].flatMap((id) => [
    {
      id,
      title: `Measurement ${id}`,
      type: 'answer' as const,
      input: 'number' as const,
      units: 'g',
    },
    {
      id: `${id}-auto`,
      title: `Check ${id}`,
      type: 'checkpoint' as const,
      mode: 'automatic' as const,
      required: true,
      answerIds: [id],
      rule: { kind: 'numeric' as const, expected: 2.5, tolerance: 0.01, units: 'g' },
    },
    {
      id: `${id}-ta`,
      title: `Explain ${id}`,
      type: 'checkpoint' as const,
      mode: 'ta' as const,
      required: true,
      answerIds: [id],
      rubric: 'Explain your measurement.',
    },
  ]);
  await teacher.put('/api/labs/demo-lab').send(draft).expect(200);
  const publicationId = (await teacher.post('/api/labs/demo-lab/publish').send({}).expect(201)).body
    .id;
  await Promise.all(
    [student, other].map((agent) =>
      agent.post('/api/join').send({ publicationId, name: 'Existing student' }).expect(200),
    ),
  );
  return { app, teacher, student, other, ta, base: `/api/publications/${publicationId}` };
}
async function answer(agent: Agent, base: string, blockId: string, value = '2.5', units = 'g') {
  await agent.put(`${base}/answers/${blockId}`).send({ value, units }).expect(200);
}
async function approve(student: Agent, ta: Agent, base: string, blockId: string) {
  const { id } = (
    await student
      .post(`${base}/queue`)
      .send({
        type: 'checkoff',
        blockId,
        description: 'Ready to explain my measurement.',
      })
      .expect(201)
  ).body;
  await ta.post(`${base}/queue/${id}/claim`).send({}).expect(200);
  await ta.post(`${base}/queue/${id}/approve`).send({}).expect(200);
  await ta.post(`${base}/queue/${id}/resolve`).send({}).expect(200);
}

test('student visits and saved responses never verify work; only a successful automatic check does', async (t) => {
  const { student, base } = await fixture(t);
  await student.post(`${base}/visit`).send({ blockId: 'a' }).expect(200);
  let progress = (await state(student, base)).progress;
  assert.equal(progress.currentBlockId, 'a');
  assert.deepEqual(progress.answers, []);
  assert.deepEqual(progress.completions, []);
  await student
    .post(`${base}/checks/a-auto`)
    .send({})
    .expect(200)
    .expect((r) => assert.equal(r.body.passed, false));
  await answer(student, base, 'a');
  progress = (await state(student, base)).progress;
  assert.equal(progress.answers[0].value, '2.5');
  assert.deepEqual(progress.completions, []);
  await student
    .post(`${base}/checks/a-auto`)
    .send({})
    .expect(200)
    .expect((r) => assert.equal(r.body.passed, true));
  await student.post(`${base}/visit`).send({ blockId: 'b' }).expect(200);
  progress = (await state(student, base)).progress;
  assert.deepEqual(
    progress.completions.map((c) => [c.blockId, c.method]),
    [['a-auto', 'automatic']],
  );
  await student.post(`${base}/checks/a-ta`).send({}).expect(400);
  assert.deepEqual((await state(student, base)).progress.completions, progress.completions);
});

test('incorrect values and units fail checks; rejected submissions retain previously saved work', async (t) => {
  const { student, base } = await fixture(t);
  for (const [value, units] of [
    ['25', 'g'],
    ['2.5', 'kg'],
  ]) {
    await answer(student, base, 'a', value, units);
    await student
      .post(`${base}/checks/a-auto`)
      .send({})
      .expect(200)
      .expect((r) => assert.equal(r.body.passed, false));
    assert.deepEqual((await state(student, base)).progress.completions, []);
  }
  await answer(student, base, 'a');
  await student.post(`${base}/checks/a-auto`).send({}).expect(200);
  const saved = (await state(student, base)).progress;
  for (const value of ['', 'NaN', 'Infinity', '2.5 grams', '0x10']) {
    await student.put(`${base}/answers/a`).send({ value, units: 'g' }).expect(400);
    const after = (await state(student, base)).progress;
    assert.deepEqual(after.answers, saved.answers);
    assert.deepEqual(after.completions, saved.completions);
  }
  await student.put(`${base}/answers/a-auto`).send({ value: '2.5', units: 'g' }).expect(400);
  await student.post(`${base}/visit`).send({ blockId: 'missing' }).expect(400);
  assert.deepEqual((await state(student, base)).progress, saved);
});

test('editing one answer revokes only its automatic and TA approvals, preserving unrelated work', async (t) => {
  const { student, ta, base } = await fixture(t);
  for (const id of ['a', 'b']) {
    await answer(student, base, id);
    await student.post(`${base}/checks/${id}-auto`).send({}).expect(200);
    await approve(student, ta, base, `${id}-ta`);
  }
  const before = (await state(student, base)).progress;
  assert.equal(before.completions.length, 4);
  await answer(student, base, 'a');
  assert.deepEqual(
    (await state(student, base)).progress.completions,
    before.completions,
    'Resubmitting unchanged work must preserve existing approvals',
  );
  await answer(student, base, 'a', '3');
  let after = (await state(student, base)).progress;
  assert.deepEqual(
    after.completions,
    before.completions.filter((c) => c.blockId.startsWith('b-')),
  );
  assert.deepEqual(after.requests, before.requests, 'Answer edits do not rewrite queue history');
  assert.deepEqual(
    after.answers.find((a) => a.blockId === 'b'),
    before.answers.find((a) => a.blockId === 'b'),
  );
  await answer(student, base, 'b', '2.5', 'kg');
  after = (await state(student, base)).progress;
  assert.deepEqual(after.completions, [], 'A units-only edit also revokes dependent approvals');
});

test('saved student work recovers in a new session and cannot be redirected by a forged identity', async (t) => {
  const { app, student, other, base } = await fixture(t);
  await answer(student, base, 'a');
  await student.post(`${base}/checks/a-auto`).send({}).expect(200);
  await other
    .put(`${base}/answers/a`)
    .send({ value: '8', units: 'g', studentId: 'student-1' })
    .expect(200);
  await other.post(`${base}/visit`).send({ blockId: 'b', studentId: 'student-1' }).expect(200);
  const saved = (await state(student, base)).progress;
  assert.equal(saved.answers[0].value, '2.5');
  assert.equal(saved.completions.length, 1);
  assert.equal(saved.currentBlockId, null);
  const otherProgress = (await state(other, base)).progress;
  assert.equal(otherProgress.answers[0].value, '8');
  assert.equal(otherProgress.currentBlockId, 'b');
  assert.deepEqual(otherProgress.completions, []);
  const reloaded = request.agent(app);
  await login(reloaded, 'student-1');
  assert.deepEqual((await state(reloaded, base)).progress, saved);
  const original = await state(reloaded, '/api/publications/demo-publication');
  assert.deepEqual(original.progress.answers, [], 'Another publication remains independent');
  const unenrolled = request.agent(app);
  await login(unenrolled, 'student-3');
  await unenrolled.get(`${base}/student`).expect(403);
  await unenrolled.put(`${base}/answers/a`).send({ value: '2.5', units: 'g' }).expect(403);
  await unenrolled.post(`${base}/checks/a-auto`).send({}).expect(403);
});
