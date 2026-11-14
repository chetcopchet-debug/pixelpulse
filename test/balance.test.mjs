import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// lib/balance.js imports the counters (which need the database package); the pure part is tested from a copy.
const src = readFileSync(new URL('../lib/balance.js', import.meta.url), 'utf8').replace(/^import .*$/gm, '');
const mod = await import(`data:text/javascript;base64,${Buffer.from(`const FOREVER='x',FREE_SPEND_KEY='a',PAID_SPEND_KEY='b',HELP_SPEND_KEY='c';const bump=async()=>0;const getSupabase=()=>null;${src}`).toString('base64')}`);

test('balance estimate: what was typed in, less what was counted after that moment', () => {
  // $25 typed in when $3.20 had already been counted that day; $7.70 counted in all since the start of that day
  assert.deepEqual(mod.estimateLeft(25, 7.7, 3.2), { spent: 4.5, left: 20.5 });
  assert.deepEqual(mod.estimateLeft(25, 3.2, 3.2), { spent: 0, left: 25 });
  assert.equal(mod.estimateLeft(10, 2, 5).left, 10, 'never adds money when the counters were reset below the base');
  assert.equal(mod.estimateLeft(5, 9, 0).left, -4, 'can go below zero: then the number typed in was too low');
  assert.equal(mod.LOW_BALANCE_USD, 6);
});
