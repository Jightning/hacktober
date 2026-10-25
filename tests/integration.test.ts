import test from 'node:test';
import assert from 'node:assert/strict';
import { canLeaveWorkspace } from '../src/app/navigationGuard.js';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';

test('G1 shell guard consumes simulated dirty, save and unmount reports', () => {
  let dirty = false;
  const reportDirty = (value: boolean) => {
    dirty = value;
  };
  const unexpectedPrompt = () => {
    throw new Error('Clean navigation must not prompt');
  };
  assert.equal(canLeaveWorkspace(dirty, unexpectedPrompt), true);
  reportDirty(true);
  let prompts = 0;
  assert.equal(
    canLeaveWorkspace(dirty, (message) => {
      prompts++;
      assert.match(message, /without saving/);
      return false;
    }),
    false,
  );
  assert.equal(dirty, true);
  assert.equal(prompts, 1);
  assert.equal(
    canLeaveWorkspace(dirty, () => true),
    true,
  );
  reportDirty(false); // Confirmed transition/unmount or successful save.
  assert.equal(canLeaveWorkspace(dirty, unexpectedPrompt), true);
});

test('published lab supports joined student guidance, competing TAs, approval and revocation', async (t) => {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  seed(db);
  const app = createApp(db, { demoAuth: true, mockAI: true });
  const teacher = request.agent(app);
  const student = request.agent(app);
  const tas = [request.agent(app), request.agent(app)];
  await teacher.post('/api/session/demo').send({ id: 'teacher-1' }).expect(200);
  for (const [index, ta] of tas.entries())
    await ta
      .post('/api/session/demo')
      .send({ id: `ta-${index + 1}` })
      .expect(200);
  const draft = (await teacher.get('/api/labs/demo-lab').expect(200)).body;
  draft.title = 'Combined route rehearsal';
  await teacher.put('/api/labs/demo-lab').send(draft).expect(200);
  const publication = (await teacher.post('/api/labs/demo-lab/publish').send({}).expect(201)).body
    .id;
  const base = `/api/publications/${publication}`;
  const identity = (
    await student
      .post('/api/join')
      .send({ publicationId: publication, name: 'Integration student' })
      .expect(200)
  ).body;
  await student.post(`${base}/visit`).send({ blockId: 'density' }).expect(200);
  await student.put(`${base}/answers/density`).send({ value: '2.5', units: 'g/mL' }).expect(200);
  let work = (await student.get(`${base}/student`).expect(200)).body;
  assert.equal(work.progress.completions.length, 0);
  assert.doesNotMatch(JSON.stringify(work), /rubric|instructorNotes|tolerance|expected/);
  assert.equal(
    (await student.post(`${base}/checks/density-check`).send({}).expect(200)).body.passed,
    true,
  );
  const hint = (
    await student
      .post(`${base}/assistant`)
      .send({ message: 'What does density measure?' })
      .expect(200)
  ).body;
  assert.equal(hint.mock, true);
  const id = (
    await student
      .post(`${base}/queue`)
      .send({ type: 'checkoff', blockId: 'discussion', description: 'Ready to explain.' })
      .expect(201)
  ).body.id;
  const claims = await Promise.all(tas.map((ta) => ta.post(`${base}/queue/${id}/claim`).send({})));
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
  const winner = tas[claims[0]!.status === 200 ? 0 : 1]!;
  const taHint = (
    await winner
      .post(`${base}/assistant`)
      .send({ studentId: identity.id, message: 'Review the submitted work.' })
      .expect(200)
  ).body;
  assert.equal(taHint.mock, true);
  await winner.post(`${base}/queue/${id}/approve`).send({}).expect(200);
  let overview = (await winner.get(`${base}/staff`).expect(200)).body;
  assert.equal(overview.stats.completed, 1);
  assert.equal(overview.requests[0].state, 'claimed');
  assert.match(overview.instructorContext.discussion, /mass divided by volume/);
  await winner.post(`${base}/queue/${id}/resolve`).send({}).expect(200);
  assert.equal((await winner.get(`${base}/staff`).expect(200)).body.requests.length, 0);
  await student.put(`${base}/answers/density`).send({ value: '3', units: 'g/mL' }).expect(200);
  overview = (await winner.get(`${base}/staff`).expect(200)).body;
  assert.equal(overview.stats.completed, 0);
  assert.equal(overview.students[0].completions.length, 0);
  work = (await student.get(`${base}/student`).expect(200)).body;
  assert.equal(work.progress.answers[0].value, '3');
  assert.equal(work.progress.completions.length, 0);
  assert.equal((await student.get(`${base}/assistant`).expect(200)).body.length, 2);
});
