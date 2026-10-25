import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnswer } from '../server/modules/progress/validation.js';
test('normalized exact-text checks and bounded numeric checks', () => {
  assert.equal(
    validateAnswer({ kind: 'exact', expected: 'Mass Per Volume' }, '  mass   per VOLUME ', ''),
    true,
  );
  assert.equal(
    validateAnswer({ kind: 'exact', expected: 'Mass Per Volume' }, 'volume per mass', ''),
    false,
  );
  const rule = { kind: 'numeric' as const, expected: 2.5, tolerance: 0.05, units: 'g/mL' };
  for (const value of ['2.45', '2.5', '2.55'])
    assert.equal(validateAnswer(rule, value, 'g/mL'), true);
  for (const value of ['', 'NaN', 'Infinity', '0x2', '2.551', '-2.5'])
    assert.equal(validateAnswer(rule, value, 'g/mL'), false);
  assert.equal(validateAnswer(rule, '2.5', 'kg'), false);
});
