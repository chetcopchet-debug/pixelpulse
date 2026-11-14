import test from 'node:test';
import assert from 'node:assert/strict';

// lib/errorLog.js imports the counters (which need the database package); the pure parts are tested from a copy
// of their source so this runs anywhere.
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../lib/errorLog.js', import.meta.url), 'utf8').replace(/^import .*$/m, 'const bump = async () => 0;');
const mod = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);

test('messages are stripped of anything personal before they are counted', () => {
  const m = mod.cleanMessage('auth start 429 for maya@example.com at https://x.supabase.co/auth/v1/otp id 3f2b8c1e-1a2b-4c3d-9e8f-0123456789ab took 1234 ms');
  assert.equal(m.includes('maya'), false); assert.equal(m.includes('supabase.co'), false); assert.equal(/\d/.test(m), false);
  assert.ok(m.includes('<email>') && m.includes('<link>') && m.includes('<id>'));
});
test('an answer object contributes only its message, never its contents', () => {
  const t = mod.textOf(['Replicate error:', 500, { detail: 'Server side error', input: { prompt: 'a secret prompt' } }]);
  assert.equal(t, 'Replicate error: 500 Server side error');
});
test('the summary groups by place and message and puts today first', () => {
  const rows = [
    { key: 'err:server:Prediction failed: Server side error', day: '2026-11-13', amount: 4 }, { key: 'err:server:Prediction failed: Server side error', day: '2026-11-12', amount: 1 },
    { key: 'err:browser:error Load failed', day: '2026-11-12', amount: 9 }, { key: 'model:fail:x/y:1', day: '2026-11-13', amount: 3 },
  ];
  const s = mod.summarize(rows, '2026-11-13', '2026-11-12');
  assert.deepEqual(s.map((e) => [e.where, e.today, e.yesterday]), [['server', 4, 1], ['browser', 0, 9]]);
});

test('what went wrong: noise is left out, and safety, balance and rate limit come first', () => {
  const { summarize, kindOf, NOISE } = mod;
  assert.ok(NOISE.test('video repair skipped <id> already in the web format'));
  assert.ok(NOISE.test('(node:#) ExperimentalWarning: vm.USE_MAIN_CONTEXT_DEFAULT_LOADER is an experimental feature'));
  assert.equal(kindOf('Safety check unavailable: no checker answered; the result is blocked'), 'safety');
  assert.equal(kindOf('NSFW classifier unavailable: timeout'), 'safety');
  assert.equal(kindOf('Replicate throttled, waiting # ms: Request was throttled. Your rate limit for creating predictions is reduced to # requests per minute until you have at least $# in credit'), 'balance');
  assert.equal(kindOf('Translate: openai/gpt-#-nano #: Replicate asked to slow down'), 'rate');
  assert.equal(kindOf('Prediction failed: User Input Error'), '');
  const day = '2026-11-14';
  const rows = [
    { key: 'err:server:Prediction failed: User Input Error', day, amount: 50 },
    { key: 'err:server:video repair skipped <id> already in the web format', day, amount: 99 },
    { key: 'err:server:Translate: x #: Replicate asked to slow down', day, amount: 2 },
    { key: 'err:server:NSFW classifier unavailable: timeout', day, amount: 1 },
  ];
  const out = summarize(rows, day, '2026-11-13');
  assert.deepEqual(out.map((e) => e.kind), ['safety', 'rate', '']);
});
