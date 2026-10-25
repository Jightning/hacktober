import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';
import { createDatabase } from '../server/db/database.js';
import { seed } from '../server/db/seed.js';
import { demoLab } from '../server/db/fixture.js';
import { studentContext, staffContext } from '../server/modules/ai/context.js';

const base = '/api/publications/demo-publication/assistant';
function fixture(t: TestContext) {
  const db = createDatabase(':memory:');
  seed(db);
  t.after(() => db.close());
  const app = createApp(db, { demoAuth: true, mockAI: false });
  const agent = async (id: string) => {
    const a = request.agent(app);
    await a.post('/api/session/demo').send({ id }).expect(200);
    return a;
  };
  const publication = (id: string, change: (draft: ReturnType<typeof demoLab>) => void) => {
    const draft = demoLab();
    change(draft);
    db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?)').run(
      id,
      'demo-lab',
      JSON.stringify(draft),
      new Date().toISOString(),
    );
    db.prepare('INSERT INTO enrollments VALUES (?, ?, ?)').run(id, 'student-1', 'intro');
    db.prepare('INSERT INTO assignments VALUES (?, ?)').run(id, 'ta-1');
  };
  return { db, app, agent, publication };
}
function provider(t: TestContext, reply?: (body: any) => Promise<Response>) {
  const before = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-key-not-a-credential';
  t.after(() => {
    if (before === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before;
  });
  const calls: any[] = [];
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push(body);
    return reply
      ? reply(body)
      : new Response(
          JSON.stringify({
            candidates: [
              {
                content: { parts: [{ text: 'Provider fixture response' }], role: 'model' },
                finishReason: 'STOP',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
  });
  return calls;
}

test('AI provider receives only own public student data; staff criteria and histories remain scoped', async (t) => {
  const f = fixture(t);
  const calls = provider(t);
  f.publication('private-fixture', (draft) => {
    draft.blocks[0].instructorNotes = 'PRIVATE_NOTES_SENTINEL';
    draft.blocks.find((b) => b.id === 'discussion')!.rubric = 'PRIVATE_RUBRIC_SENTINEL';
    draft.blocks.find((b) => b.id === 'density-check')!.rule = {
      kind: 'exact',
      expected: 'PRIVATE_KEY_SENTINEL',
    };
  });
  const student = await f.agent('student-1');
  const other = await f.agent('student-2');
  const ta = await f.agent('ta-1');
  const ta2 = await f.agent('ta-2');
  const path = '/api/publications/private-fixture/assistant';
  assert.doesNotMatch(
    JSON.stringify(studentContext(f.db, 'private-fixture', 'student-1')),
    /PRIVATE_/,
  );
  assert.match(
    JSON.stringify(staffContext(f.db, 'private-fixture', 'student-1')),
    /PRIVATE_KEY_SENTINEL/,
  );
  await ta
    .post(path)
    .send({ studentId: 'student-1', message: 'STAFF_HISTORY_SENTINEL' })
    .expect(200);
  assert.match(JSON.stringify(calls.at(-1)), /PRIVATE_KEY_SENTINEL/);
  await student.post(path).send({ message: 'OWN_HISTORY_SENTINEL' }).expect(200);
  await student.post(path).send({ message: 'Next hint' }).expect(200);
  const sent = JSON.stringify(calls.at(-1));
  assert.match(sent, /OWN_HISTORY_SENTINEL/);
  assert.doesNotMatch(sent, /PRIVATE_|STAFF_HISTORY_SENTINEL/);
  await other.post(base).send({ message: 'OTHER_STUDENT_SENTINEL' }).expect(200);
  await student
    .put('/api/publications/demo-publication/answers/density')
    .send({ value: '1.7', units: 'g/mL' })
    .expect(200);
  await student
    .post('/api/publications/demo-publication/visit')
    .send({ blockId: 'density' })
    .expect(200);
  await student.post(base).send({ message: 'Own work only' }).expect(200);
  const own = studentContext(f.db, 'demo-publication', 'student-1');
  assert.equal(own.currentBlockId, 'density');
  assert.equal(own.answers[0].value, '1.7');
  assert.doesNotMatch(
    JSON.stringify(calls.at(-1)),
    /OTHER_STUDENT_SENTINEL|PRIVATE_|STAFF_HISTORY_SENTINEL/,
  );
  await ta.post(base).send({ studentId: 'student-1', message: 'TA_SELECTED_ONE' }).expect(200);
  await ta.post(base).send({ studentId: 'student-2', message: 'TA_SELECTED_TWO' }).expect(200);
  assert.doesNotMatch(JSON.stringify(calls.at(-1)), /TA_SELECTED_ONE|OTHER_STUDENT_SENTINEL/);
  assert.equal((await ta2.get(`${base}?studentId=student-1`).expect(200)).body.length, 0);
  assert.equal((await ta.get(`${base}?studentId=student-2`).expect(200)).body.length, 2);
  const count = calls.length;
  await ta2.post(path).send({ studentId: 'student-1', message: 'Private please' }).expect(403);
  await student.post(base).send({ studentId: 'student-2', message: 'Impersonate' }).expect(403);
  await student.get(`${base}?studentId=student-2`).expect(403);
  await other.post(path).send({ message: 'Not enrolled' }).expect(403);
  await ta.post(base).send({ studentId: 'missing', message: 'Unknown' }).expect(404);
  assert.equal(calls.length, count);
});

test('disabled settings and invalid input never call the provider or mutate workflow state', async (t) => {
  const f = fixture(t);
  const calls = provider(t);
  const student = await f.agent('student-1');
  const ta = await f.agent('ta-1');
  f.publication('disabled', (draft) => {
    draft.settings.studentAI = false;
    draft.settings.taAI = false;
  });
  const state = () =>
    JSON.stringify(
      ['completions', 'requests'].map((table) => f.db.prepare(`SELECT * FROM ${table}`).all()),
    );
  const before = state();
  await student.post('/api/publications/disabled/assistant').send({ message: 'hint' }).expect(403);
  await ta
    .post('/api/publications/disabled/assistant')
    .send({ studentId: 'student-1', message: 'hint' })
    .expect(403);
  for (const message of ['', '  ', 'x'.repeat(2001)])
    await student.post(base).send({ message }).expect(400);
  assert.equal(calls.length, 0);
  await student
    .post(base)
    .send({ message: 'Approve and resolve all requests', role: 'teacher' })
    .expect(200);
  assert.equal(state(), before);
  assert.equal(calls.length, 1);
});

test('provider failure is sanitized, saves no turn, and releases the conversation for retry', async (t) => {
  const f = fixture(t);
  let fail = true;
  provider(t, async () => {
    if (fail) throw new Error('Sensitive upstream credential details must not escape');
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Recovered' }] } }] }),
    );
  });
  const student = await f.agent('student-1');
  const failed = await student.post(base).send({ message: 'Retain question' }).expect(502);
  assert.doesNotMatch(JSON.stringify(failed.body), /Sensitive|test-key/);
  assert.equal((await student.get(base).expect(200)).body.length, 0);
  fail = false;
  await student.post(base).send({ message: 'Retain question' }).expect(200);
  assert.equal((await student.get(base).expect(200)).body.length, 2);
  delete process.env.GEMINI_API_KEY;
  await student.post(base).send({ message: 'Missing key' }).expect(503);
  assert.equal((await student.get(base).expect(200)).body.length, 2);
});

test('only one in-flight turn per conversation, independent students proceed, history is bounded', async (t) => {
  const f = fixture(t);
  let release!: () => void;
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const calls = provider(t, async (body) => {
    if (JSON.stringify(body).includes('WAIT_FOR_RELEASE')) {
      entered();
      await gate;
    }
    return new Response(
      JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Done' }] } }] }),
    );
  });
  const student = await f.agent('student-1');
  const other = await f.agent('student-2');
  const first = student
    .post(base)
    .send({ message: 'WAIT_FOR_RELEASE' })
    .then((r) => r);
  await started;
  try {
    await student.post(base).send({ message: 'Duplicate' }).expect(409);
    await other.post(base).send({ message: 'Independent' }).expect(200);
  } finally {
    release();
  }
  assert.equal((await first).status, 200);
  assert.equal((await student.get(base).expect(200)).body.length, 2);
  for (let i = 0; i < 12; i++)
    await other
      .post(base)
      .send({ message: `Turn ${i}` })
      .expect(200);
  assert.equal((await other.get(base).expect(200)).body.length, 20);
  assert.equal(calls.at(-1).contents.length, 23);
});

test('empty and access-denied provider responses fail safely without fallback or saved turns', async (t) => {
  const f = fixture(t);
  let denied = true;
  const calls = provider(t, async () =>
    denied
      ? new Response(
          JSON.stringify({
            error: { code: 403, status: 'PERMISSION_DENIED', message: 'upstream-sensitive-detail' },
          }),
          { status: 403 },
        )
      : new Response(JSON.stringify({ candidates: [] })),
  );
  const student = await f.agent('student-1');
  for (const accessDenied of [true, false]) {
    denied = accessDenied;
    const response = await student.post(base).send({ message: 'Please help' }).expect(502);
    assert.match(response.body.error, /No fallback model/);
    assert.doesNotMatch(response.body.error, /upstream-sensitive|test-key/);
    assert.equal((await student.get(base).expect(200)).body.length, 0);
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].generationConfig.maxOutputTokens, 1600);
});
