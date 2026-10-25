import test from 'node:test';
import assert from 'node:assert/strict';
import { canLeaveWorkspace } from '../src/app/navigationGuard.js';

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
