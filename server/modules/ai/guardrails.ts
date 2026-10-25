import type { AssistantReply } from '../../../shared/contracts.js';
import type { PrivateBlock } from '../labs/model.js';
import type { ProviderInput } from './provider.js';
import { HttpError } from '../../http.js';

const MAX_CONTEXT_CHARS = 120_000;
const MAX_REPLY_CHARS = 12_000;
const privateFields = new Set([
  'instructorContext',
  'instructorNotes',
  'rule',
  'rubric',
  'expected',
  'tolerance',
]);
const overrideAttempt =
  /\bignore\s+(?:all\s+)?(?:previous|prior|system|developer|above)\s+(?:instructions?|rules?|prompts?)\b|\b(?:reveal|print|repeat|show)\s+(?:the\s+|your\s+)?(?:system|developer)\s+prompt\b|\bsystem\s+override\s*:/i;
const completedAction =
  /\bI\s+(?:have\s+)?(?:approved|verified|graded|resolved|cancelled)\s+(?:your|the|this)\s+(?:checkpoint|checkoff|submission|request|grade|work)\b|\byour\s+(?:checkpoint|checkoff|request)\s+(?:is|has been)\s+(?:now\s+)?(?:approved|verified|resolved|cancelled)\b/i;

function normalized(text: string) {
  return text
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}
function containsCredential(text: string) {
  const key = process.env.GEMINI_API_KEY;
  return (
    Boolean(key && text.includes(key)) ||
    /AIza[0-9A-Za-z_-]{35}/.test(text) ||
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
  );
}
function containsPrivateField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsPrivateField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(
    ([key, child]) => privateFields.has(key) || containsPrivateField(child),
  );
}

/** Runs after server authorization/projection and before any provider call. Never logs input. */
export function checkAssistantInput(input: ProviderInput) {
  const reject = (message: string): never => {
    throw new HttpError(400, message);
  };
  let context: string;
  try {
    context = JSON.stringify(input.context);
  } catch {
    throw new HttpError(503, 'Assistant context is unavailable. Ask a TA for help.');
  }
  if (!context || context.length > MAX_CONTEXT_CHARS)
    throw new HttpError(413, 'This lab is too large for the assistant. Ask a TA for help.');
  if (
    !input.message.trim() ||
    input.message.length > 2000 ||
    input.history.length > 20 ||
    input.history.some(
      (m) => !['user', 'assistant'].includes(m.role) || m.text.length > MAX_REPLY_CHARS,
    )
  )
    reject('The assistant input exceeds its supported limits. Start with a shorter question.');
  if (input.audience === 'student' && containsPrivateField(input.context))
    throw new HttpError(
      503,
      'Student assistant context failed its privacy check. Ask a TA for help.',
    );
  const untrusted = [context, input.message, ...input.history.map((m) => m.text)].join('\n');
  if (containsCredential(untrusted))
    reject('The assistant input contains a credential. Remove it before requesting guidance.');
  if (overrideAttempt.test(normalized(untrusted)))
    reject(
      'The assistant cannot follow instruction overrides. Rephrase your question, or ask a TA to review the lab content.',
    );
}

/** Private criteria stay here on the server; they are never added to student provider input. */
export function checkAssistantReply(
  reply: AssistantReply,
  audience: ProviderInput['audience'],
  blocks: PrivateBlock[],
) {
  const withhold = (): never => {
    throw new HttpError(
      502,
      'The assistant reply was withheld by safety checks. Try a conceptual question or ask a TA.',
    );
  };
  if (
    typeof reply.text !== 'string' ||
    !reply.text.trim() ||
    reply.text.length > MAX_REPLY_CHARS ||
    typeof reply.mock !== 'boolean' ||
    typeof reply.model !== 'string' ||
    !reply.model.trim() ||
    reply.model.length > 200
  )
    withhold();
  const text = normalized(reply.text);
  if (
    containsCredential(reply.text) ||
    containsCredential(reply.model) ||
    completedAction.test(text)
  )
    withhold();
  if (audience !== 'student') return;
  for (const block of blocks) {
    // Conservative verbatim checks, not semantic classifiers. See route notes for limits.
    for (const privateText of [block.instructorNotes, block.rubric]) {
      if (
        privateText &&
        normalized(privateText).length >= 12 &&
        text.includes(normalized(privateText))
      )
        withhold();
    }
    if (block.rule?.kind === 'exact') {
      const answer = normalized(block.rule.expected);
      const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (answer && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(text))
        withhold();
    }
    if (block.rule?.kind === 'numeric') {
      const numbers = text.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?/g) || [];
      const expected = block.rule.expected;
      if (numbers.some((value) => Number(value) === expected)) withhold();
    }
  }
}
