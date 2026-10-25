import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function runner() {
  const html = readFileSync(new URL('../public/python-runner.html', import.meta.url), 'utf8');
  const source = html.match(/<script>([\s\S]*?)<\/script>/)![1];
  const messages: unknown[] = [];
  const workers: any[] = [];
  const timers: (() => void)[] = [];
  const parent = { postMessage: (value: unknown) => messages.push(value) };
  class Worker {
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    terminated = false;
    postMessage() {}
    terminate() {
      this.terminated = true;
    }
    constructor() {
      workers.push(this);
    }
  }
  const context = vm.createContext({
    parent,
    Worker,
    Blob,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    setTimeout: (f: () => void) => {
      timers.push(f);
      return timers.length;
    },
    clearTimeout() {},
    console,
  });
  vm.runInContext(source, context);
  return { context, parent, messages, workers, timers };
}
test('Python runner ignores messages from other windows and terminates on stop', () => {
  const r = runner();
  r.context.onmessage({ source: {}, data: { type: 'run', code: 'print(1)' } });
  assert.equal(r.workers.length, 0);
  r.context.onmessage({ source: r.parent, data: { type: 'run', code: 'print(1)' } });
  assert.equal(r.workers.length, 1);
  r.context.onmessage({ source: r.parent, data: { type: 'stop' } });
  assert.equal(r.workers[0].terminated, true);
});
test('Python runner bounds output and only forwards text', () => {
  const r = runner();
  r.context.onmessage({ source: r.parent, data: { type: 'run', code: 'print(1)' } });
  r.workers[0].onmessage({ data: { type: 'output', text: 'x'.repeat(50000) } });
  assert.equal(r.workers[0].terminated, true);
  const text = r.messages.map((m: any) => m.text || '').join('');
  assert.ok(text.length < 21000);
  assert.match(text, /Output limit/);
});
test('Python runner times out without blocking the host UI', () => {
  const r = runner();
  r.context.onmessage({ source: r.parent, data: { type: 'run', code: 'while True: pass' } });
  r.timers[0]();
  assert.equal(r.workers[0].terminated, true);
  assert.match(JSON.stringify(r.messages), /timed out/);
});

test('Python cannot extend its deadline by sending repeated running messages', () => {
  const r = runner();
  r.context.onmessage({ source: r.parent, data: { type: 'run', code: 'print(1)' } });
  r.workers[0].onmessage({ data: { type: 'running' } });
  r.workers[0].onmessage({ data: { type: 'running' } });
  assert.equal(r.timers.length, 2);
  r.timers[1]();
  assert.equal(r.workers[0].terminated, true);
});
