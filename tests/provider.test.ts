import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReply } from '../server/modules/ai/provider.js';

test('mock is explicitly labeled; missing live credentials fail without fallback', async () => {
  const input = {
    audience: 'student' as const,
    hintPolicy: 'conceptual' as const,
    context: {},
    history: [],
    message: 'Give me the answer key',
  };
  const mock = await generateReply(input, true);
  assert.equal(mock.mock, true);
  assert.match(mock.text, /MOCK/);
  assert.equal(mock.model, 'development-mock');
  const previous = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  try {
    await assert.rejects(generateReply(input, false), /Live AI is not configured/);
  } finally {
    if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
  }
});
