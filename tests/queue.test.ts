import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';

const base = '/api/publications/demo-publication';
async function fixture(t: test.TestContext) {
  const db = createDatabase(':memory:');
  t.after(() => db.close());
  seed(db);
  const app = createApp(db, { demoAuth: true, mockAI: true });
  const agents = Object.fromEntries(
    ['ta-1', 'ta-2', 'student-1', 'student-2', 'student-3'].map((id) => [id, request.agent(app)]),
  );
  for (const [id, agent] of Object.entries(agents))
    await agent.post('/api/session/demo').send({ id }).expect(200);
  const action = (actor: string, id: string, verb: string) =>
    agents[actor]!.post(`${base}/queue/${id}/${verb}`).send({});
  return { db, agents, action };
}

test('competing claims store exactly one claimant; only that claimant can act', async (t) => {
  const { db, action } = await fixture(t);
  const claims = await Promise.all(
    ['ta-1', 'ta-2'].map((id) => action(id, 'demo-checkoff', 'claim')),
  );
  assert.deepEqual(claims.map((r) => r.status).sort(), [200, 409]);
  const winner = claims[0]!.status === 200 ? 'ta-1' : 'ta-2';
  const loser = winner === 'ta-1' ? 'ta-2' : 'ta-1';
  const row = db
    .prepare('SELECT state, claimed_by FROM requests WHERE id = ?')
    .get('demo-checkoff');
  assert.equal(row?.state, 'claimed');
  assert.equal(row?.claimed_by, winner);
  for (const verb of ['approve', 'resolve', 'release'])
    await action(loser, 'demo-checkoff', verb).expect(409);
  await action(winner, 'demo-checkoff', 'release').expect(200);
  await action(loser, 'demo-checkoff', 'claim').expect(200);
  assert.equal(
    db.prepare('SELECT claimed_by FROM requests WHERE id = ?').get('demo-checkoff')?.claimed_by,
    loser,
  );
});

test('help cannot approve; release, reclaim and resolution preserve completion counts', async (t) => {
  const { agents, action } = await fixture(t);
  const before = (await agents['ta-1']!.get(`${base}/staff`).expect(200)).body;
  await action('ta-1', 'demo-help', 'claim').expect(200);
  await action('ta-1', 'demo-help', 'approve').expect(400);
  await action('ta-1', 'demo-help', 'release').expect(200);
  await action('ta-2', 'demo-help', 'claim').expect(200);
  await action('ta-2', 'demo-help', 'resolve').expect(200);
  await action('ta-2', 'demo-help', 'resolve').expect(409);
  const after = (await agents['ta-1']!.get(`${base}/staff`).expect(200)).body;
  assert.deepEqual(after.stats, before.stats);
  assert.equal(
    after.requests.some((r: any) => r.id === 'demo-help'),
    false,
  );
});

test('approval and resolution are distinct; changed referenced work revokes stored approval and overview', async (t) => {
  const { agents, action } = await fixture(t);
  await action('ta-1', 'demo-checkoff', 'claim').expect(200);
  await action('ta-1', 'demo-checkoff', 'approve').expect(200);
  let state = (await agents['ta-1']!.get(`${base}/staff`).expect(200)).body;
  assert.equal(state.requests.find((r: any) => r.id === 'demo-checkoff').state, 'claimed');
  assert.equal(state.stats.completed, 2);
  assert.match(state.instructorContext.discussion, /mass divided by volume/);
  const student = state.students.find((s: any) => s.student.id === 'student-3');
  assert.equal(student.answers[0].value, '2.5');
  assert.equal(student.currentBlockId, 'discussion');
  assert.equal(student.completions.find((c: any) => c.blockId === 'discussion').method, 'ta');
  await action('ta-1', 'demo-checkoff', 'resolve').expect(200);
  await agents['student-3']!.put(`${base}/answers/density`)
    .send({ value: '3', units: 'g/mL' })
    .expect(200);
  state = (await agents['ta-2']!.get(`${base}/staff`).expect(200)).body;
  assert.equal(state.stats.completed, 1);
  assert.equal(state.students.find((s: any) => s.student.id === 'student-3').completions.length, 0);
  assert.equal(
    state.requests.some((r: any) => r.id === 'demo-checkoff'),
    false,
  );
});

test('one active request, waiting-only owner cancellation and closed-window rejection', async (t) => {
  const { db, agents, action } = await fixture(t);
  const payload = { type: 'help', blockId: 'intro', description: 'Please explain.' };
  const results = await Promise.all(
    [1, 2].map(() => agents['student-1']!.post(`${base}/queue`).send(payload)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
  const id = results.find((r) => r.status === 201)!.body.id;
  await action('student-2', id, 'cancel').expect(404);
  await action('ta-1', id, 'claim').expect(200);
  await action('student-1', id, 'cancel').expect(409);
  await agents['student-1']!.post(`${base}/queue`).send(payload).expect(409);
  await action('ta-1', id, 'release').expect(200);
  await action('student-1', id, 'cancel').expect(200);
  await action('ta-2', id, 'claim').expect(409);
  // A separate closed publication avoids mutating the published seed snapshot.
  const original = db
    .prepare('SELECT snapshot FROM publications WHERE id = ?')
    .get('demo-publication')!;
  const snapshot = JSON.parse(String(original.snapshot));
  snapshot.settings.closesAt = '2000-01-01T00:00:00.000Z';
  db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?)').run(
    'closed',
    'demo-lab',
    JSON.stringify(snapshot),
    new Date().toISOString(),
  );
  db.prepare('INSERT INTO enrollments VALUES (?, ?, NULL)').run('closed', 'student-1');
  const closed = await agents['student-1']!.post('/api/publications/closed/queue')
    .send(payload)
    .expect(403);
  assert.match(closed.body.error, /closed/);
});

test('unassigned staff, students and wrong-publication requests cannot use staff actions', async (t) => {
  const { db, agents, action } = await fixture(t);
  db.prepare('DELETE FROM assignments WHERE user_id = ?').run('ta-2');
  await agents['ta-2']!.get(`${base}/staff`).expect(403);
  for (const verb of ['claim', 'release', 'approve', 'resolve']) {
    await action('ta-2', 'demo-checkoff', verb).expect(403);
    await action('student-3', 'demo-checkoff', verb).expect(403);
  }
  await agents['ta-1']!.post('/api/publications/missing/queue/demo-checkoff/claim')
    .send({})
    .expect(403);
  const publication = db
    .prepare('SELECT snapshot FROM publications WHERE id = ?')
    .get('demo-publication')!;
  db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?)').run(
    'other',
    'demo-lab',
    publication.snapshot,
    new Date().toISOString(),
  );
  db.prepare('INSERT INTO assignments VALUES (?, ?)').run('other', 'ta-1');
  await agents['ta-1']!.post('/api/publications/other/queue/demo-checkoff/claim')
    .send({})
    .expect(409);
  await agents['ta-1']!.post('/api/publications/other/queue/demo-checkoff/approve')
    .send({})
    .expect(404);
  assert.equal(
    db.prepare('SELECT state FROM requests WHERE id = ?').get('demo-checkoff')?.state,
    'waiting',
  );
});

test('checkoff requires submitted references at request and approval time', async (t) => {
  const { db, agents, action } = await fixture(t);
  const payload = { type: 'checkoff', blockId: 'discussion', description: 'Review please.' };
  await agents['student-1']!.post(`${base}/queue`).send(payload).expect(400);
  await agents['student-1']!.post(`${base}/queue`)
    .send({ ...payload, blockId: 'intro' })
    .expect(400);
  await action('ta-1', 'demo-checkoff', 'claim').expect(200);
  // Simulate absent referenced work to exercise the server guard independently of UI state.
  db.prepare('DELETE FROM answers WHERE student_id = ?').run('student-3');
  await action('ta-1', 'demo-checkoff', 'approve').expect(400);
  assert.equal(
    db
      .prepare('SELECT 1 FROM completions WHERE student_id = ? AND block_id = ?')
      .get('student-3', 'discussion'),
    undefined,
  );
});
