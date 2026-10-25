import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';
import { studentContext, staffContext } from '../server/modules/ai/context.js';

function fixture() {
  const db = createDatabase(':memory:');
  seed(db);
  const app = createApp(db, { demoAuth: true, mockAI: true });
  return {
    db,
    app,
    student: request.agent(app),
    teacher: request.agent(app),
    ta: request.agent(app),
    ta2: request.agent(app),
  };
}
async function login(agent: ReturnType<typeof request.agent>, id: string) {
  await agent.post('/api/session/demo').send({ id }).expect(200);
}

test('student projection excludes grading and staff authorization is enforced', async () => {
  const f = fixture();
  await login(f.student, 'student-1');
  const res = await f.student.get('/api/publications/demo-publication/student').expect(200);
  assert.equal(res.body.lab.blocks.find((b: any) => b.id === 'density-check').rule, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /tolerance|rubric|expected|instructorNotes/);
  await f.student.get('/api/publications/demo-publication/staff').expect(403);
  await f.student.get('/api/labs').expect(403);
  await f.student.post('/api/session/demo').send({ id: 'invented', role: 'teacher' }).expect(400);
  await login(f.ta, 'ta-1');
  await f.ta.get('/api/publications/missing/staff').expect(403);
  f.db.close();
});

test('view and submission are separate from validation; changed answers revoke dependent checks', async () => {
  const f = fixture();
  await login(f.student, 'student-1');
  const base = '/api/publications/demo-publication';
  await f.student.post(`${base}/visit`).send({ blockId: 'density' }).expect(200);
  await f.student.put(`${base}/answers/density`).send({ value: '2.5', units: 'g/mL' }).expect(200);
  let state = (await f.student.get(`${base}/student`)).body;
  assert.equal(state.progress.completions.length, 0);
  await f.student
    .post(`${base}/checks/density-check`)
    .send({})
    .expect(200)
    .expect((r) => assert.equal(r.body.passed, true));
  await f.student.post(`${base}/checks/discussion`).send({}).expect(400);
  await f.student.put(`${base}/answers/density`).send({ value: '25', units: 'g/mL' }).expect(200);
  state = (await f.student.get(`${base}/student`)).body;
  assert.equal(state.progress.completions.length, 0);
  await f.student
    .post(`${base}/checks/density-check`)
    .send({})
    .expect(200)
    .expect((r) => assert.equal(r.body.passed, false));
  await f.student.put(`${base}/answers/density`).send({ value: '2.5', units: 'kg' }).expect(200);
  await f.student
    .post(`${base}/checks/density-check`)
    .send({})
    .expect(200)
    .expect((r) => assert.equal(r.body.passed, false));
  f.db.close();
});

test('queue duplicate prevention, ownership, atomic claims and TA approval', async () => {
  const f = fixture();
  await login(f.student, 'student-1');
  await login(f.ta, 'ta-1');
  await login(f.ta2, 'ta-2');
  const base = '/api/publications/demo-publication';
  await f.student.put(`${base}/answers/density`).send({ value: '2.5', units: 'g/mL' });
  const responses = await Promise.all(
    [1, 2].map(() =>
      f.student
        .post(`${base}/queue`)
        .send({ type: 'checkoff', blockId: 'discussion', description: 'Ready to explain.' }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const id = responses.find((r) => r.status === 201)!.body.id;
  const claims = await Promise.all(
    [f.ta, f.ta2].map((a) => a.post(`${base}/queue/${id}/claim`).send({})),
  );
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
  const winner = claims[0].status === 200 ? f.ta : f.ta2;
  const loser = claims[0].status === 200 ? f.ta2 : f.ta;
  await loser.post(`${base}/queue/${id}/approve`).send({}).expect(409);
  await winner.post(`${base}/queue/${id}/approve`).send({}).expect(200);
  await winner.post(`${base}/queue/${id}/resolve`).send({}).expect(200);
  const progress = (await f.student.get(`${base}/student`)).body.progress;
  assert.equal(progress.completions[0].method, 'ta');
  const another = request.agent(f.app);
  await login(another, 'student-2');
  await another.post(`${base}/queue/${id}/cancel`).send({}).expect(404);
  f.db.close();
});

test('AI context and histories are role scoped; settings enforced server-side', async () => {
  const f = fixture();
  await login(f.student, 'student-1');
  await login(f.ta, 'ta-1');
  const publicContext = studentContext(f.db, 'demo-publication', 'student-1');
  const privateContext = staffContext(f.db, 'demo-publication', 'student-1');
  assert.doesNotMatch(JSON.stringify(publicContext), /tolerance|rubric|expected|instructorNotes/);
  assert.match(JSON.stringify(privateContext), /tolerance/);
  const base = '/api/publications/demo-publication';
  await f.student
    .post(`${base}/assistant`)
    .send({ message: 'Give me the answer', studentId: 'student-2' })
    .expect(403);
  await f.student
    .post(`${base}/assistant`)
    .send({ message: 'Give me the answer' })
    .expect(200)
    .expect((r) => assert.equal(r.body.mock, true));
  await f.ta
    .post(`${base}/assistant`)
    .send({ message: 'Review the work', studentId: 'student-1' })
    .expect(200);
  const history = await f.student.get(`${base}/assistant`).expect(200);
  assert.equal(history.body.length, 2);
  assert.doesNotMatch(JSON.stringify(history.body), /Review the work/);
  const row = f.db
    .prepare('SELECT snapshot FROM publications WHERE id = ?')
    .get('demo-publication') as any;
  const snapshot = JSON.parse(row.snapshot);
  snapshot.settings.studentAI = false;
  snapshot.settings.taAI = false;
  f.db
    .prepare('UPDATE publications SET snapshot = ? WHERE id = ?')
    .run(JSON.stringify(snapshot), 'demo-publication');
  await f.student.post(`${base}/assistant`).send({ message: 'hint' }).expect(403);
  await f.ta
    .post(`${base}/assistant`)
    .send({ message: 'hint', studentId: 'student-1' })
    .expect(403);
  f.db.close();
});

test('draft changes do not mutate publication; invitation never grants staff', async () => {
  const f = fixture();
  await login(f.teacher, 'teacher-1');
  const draft = (await f.teacher.get('/api/labs/demo-lab')).body;
  draft.title = 'Changed draft';
  await f.teacher.put('/api/labs/demo-lab').send(draft).expect(200);
  const newcomer = request.agent(f.app);
  await newcomer
    .post('/api/join')
    .send({ publicationId: 'demo-publication', name: 'Real participant', role: 'teacher' })
    .expect(200);
  assert.equal((await newcomer.get('/api/session')).body.role, 'student');
  assert.notEqual(
    (await newcomer.get('/api/publications/demo-publication/student')).body.lab.title,
    'Changed draft',
  );
  await newcomer.get('/api/publications/demo-publication/staff').expect(403);
  f.db.close();
});

test('joining another publication preserves the student identity and previous saved work', async () => {
  const f = fixture();
  await login(f.teacher, 'teacher-1');
  const second = (await f.teacher.post('/api/labs/demo-lab/publish').send({}).expect(201)).body.id;
  const newcomer = request.agent(f.app);
  const first = (
    await newcomer
      .post('/api/join')
      .send({ publicationId: 'demo-publication', name: 'Returning student' })
      .expect(200)
  ).body;
  await newcomer
    .put('/api/publications/demo-publication/answers/density')
    .send({ value: '2.5', units: 'g/mL' })
    .expect(200);
  const joined = (
    await newcomer
      .post('/api/join')
      .send({ publicationId: second, name: 'Returning student' })
      .expect(200)
  ).body;
  assert.equal(joined.id, first.id);
  const saved = (await newcomer.get('/api/publications/demo-publication/student').expect(200)).body;
  assert.equal(saved.progress.answers[0].value, '2.5');
  f.db.close();
});

test('queue session windows, release and cancellation enforce transitions', async () => {
  const f = fixture();
  await login(f.student, 'student-1');
  await login(f.ta, 'ta-1');
  const base = '/api/publications/demo-publication';
  const id = (
    await f.student
      .post(`${base}/queue`)
      .send({ type: 'help', blockId: 'intro', description: 'Explain the concept' })
      .expect(201)
  ).body.id;
  await f.ta.post(`${base}/queue/${id}/claim`).send({}).expect(200);
  await f.student.post(`${base}/queue/${id}/cancel`).send({}).expect(409);
  await f.ta.post(`${base}/queue/${id}/release`).send({}).expect(200);
  await f.student.post(`${base}/queue/${id}/cancel`).send({}).expect(200);
  await f.ta.post(`${base}/queue/${id}/claim`).send({}).expect(409);
  const row = f.db
    .prepare('SELECT snapshot FROM publications WHERE id = ?')
    .get('demo-publication') as any;
  const draft = JSON.parse(row.snapshot);
  draft.settings.closesAt = '2000-01-01T00:00:00.000Z';
  f.db
    .prepare('UPDATE publications SET snapshot = ? WHERE id = ?')
    .run(JSON.stringify(draft), 'demo-publication');
  await f.student
    .post(`${base}/queue`)
    .send({ type: 'help', blockId: 'intro', description: 'Closed session' })
    .expect(403);
  f.db.close();
});

test('demo auth can be disabled; foreign mutations and other-student access are rejected', async () => {
  const f = fixture();
  const locked = request(createApp(f.db, { demoAuth: false, mockAI: true }));
  assert.deepEqual((await locked.get('/api/demo-identities').expect(200)).body, []);
  await locked.post('/api/session/demo').send({ id: 'teacher-1' }).expect(403);
  await f.student
    .post('/api/join')
    .set('Origin', 'https://untrusted.example')
    .send({ publicationId: 'demo-publication', name: 'Untrusted' })
    .expect(403);
  await login(f.ta, 'ta-1');
  const { id } = (
    await f.student
      .post('/api/join')
      .send({ publicationId: 'demo-publication', name: 'A new student' })
      .expect(200)
  ).body;
  const publication = f.db
    .prepare('SELECT snapshot FROM publications WHERE id = ?')
    .get('demo-publication') as any;
  f.db
    .prepare('INSERT INTO publications VALUES (?, ?, ?, ?)')
    .run('unassigned-publication', 'demo-lab', publication.snapshot, new Date().toISOString());
  f.db.prepare('INSERT INTO enrollments VALUES (?, ?, NULL)').run('unassigned-publication', id);
  await f.ta.get('/api/publications/unassigned-publication/staff').expect(403);
  await f.ta
    .post('/api/publications/unassigned-publication/assistant')
    .send({ studentId: id, message: 'Show private context' })
    .expect(403);
  await f.student.get('/api/publications/unassigned-publication/student').expect(200);
  const unrelated = request.agent(f.app);
  await login(unrelated, 'student-1');
  await unrelated.get('/api/publications/unassigned-publication/student').expect(403);
  f.db.close();
});
