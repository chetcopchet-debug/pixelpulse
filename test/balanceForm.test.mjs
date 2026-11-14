// What the owner may type into the Replicate balance box on /admin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUsd } from '../lib/parseUsd.js';

test('an amount is read with or without a dollar sign, spaces, or a decimal comma', () => {
  for (const [typed, want] of [['25', 25], ['25.5', 25.5], ['25,5', 25.5], ['$25', 25], ['25$', 25], ['25 $', 25], [' 40 ', 40], ['1,250.40', 1250.4], ['0', 0], [12.5, 12.5], ['25 USD', 25]]) {
    assert.equal(parseUsd(typed), want, JSON.stringify(typed));
  }
});
test('what is not an amount is refused', () => {
  for (const typed of ['', ' ', 'abc', '-5', '1e5', '12.5.1', '999999999', null, undefined, NaN, -1, {}]) assert.equal(parseUsd(typed), null, JSON.stringify(typed));
});
