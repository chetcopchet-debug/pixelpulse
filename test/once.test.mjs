// One press, one creation (lib/once.js on the server, the lock in the screen's store).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstTime, validRid } from '../lib/once.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
// A counter like lib/usage.js bump(): the new total, or null once the limit is passed.
const counter = () => { const seen = new Map(); return async (key, n, limit) => { const v = (seen.get(key) || 0) + n; if (v > limit) return null; seen.set(key, v); return v; }; };

test('the same press sent twice goes ahead once', async () => {
  const claim = counter(); const who = '11111111-2222-4333-8444-555555555555';
  assert.equal(await firstTime(who, 'k3j9x2ab', claim), true);
  assert.equal(await firstTime(who, 'k3j9x2ab', claim), false);
  assert.equal(await firstTime(who, 'k3j9x2ab', claim), false);
  // Another press, and another person with the same id, are their own requests.
  assert.equal(await firstTime(who, 'zz81kq0p', claim), true);
  assert.equal(await firstTime('99999999-2222-4333-8444-555555555555', 'k3j9x2ab', claim), true);
});
test('a request without an id, or when the counter is out of reach, is not stopped', async () => {
  const never = async () => { throw new Error('must not be asked'); };
  for (const rid of [undefined, null, '', 'ab', 'has space', 'x'.repeat(81), 12345678, { a: 1 }]) { assert.equal(validRid(rid), null); assert.equal(await firstTime('u', rid, never), true); }
  assert.equal(await firstTime('u', 'k3j9x2ab', async () => { throw new Error('db down'); }), true);
});
test('both creation routes ask before anything is charged', () => {
  for (const [f, charge] of [['app/api/generate/route.js', 'chargeCredits('], ['app/api/animate/route.js', 'chargePaidCredits(']]) {
    const s = read(f), at = s.indexOf('await firstTime(creator.id, body?.rid, bump)');
    assert.ok(at > 0, f); assert.ok(at < s.indexOf(charge), `${f}: before the charge`);
    assert.match(s, /duplicate: true \}, \{ status: 409 \}/);
  }
});
test('the screen: every request carries the press id, Generate is locked while the same thing is being made', () => {
  const store = read('app/studio/store.js'), create = read('app/studio/Create.js');
  assert.equal((store.match(/rid: key\b/g) || []).length, 2, 'an image and a video');
  assert.match(store, /rid: `\$\{key\}\.\$\{m\.id\}\.\$\{attempt\}`/, 'each image of a comparison, and each new try of it');
  assert.match(store, /runsRef\.current\.some\(\(r\) => r\.status === "running" && r\.sig === sig\)/);
  assert.equal((create.match(/disabled=\{!canGo \|\| s\.generating\}/g) || []).length, 2, 'the phone button and the desktop button');
});
test('the phone prompt box closes when a creation starts, so the waiting screen has room', () => {
  const create = read('app/studio/Create.js');
  assert.match(create, /if \(startedKey\) \{ setSlim\(true\); setBig\(false\); \}/);
  assert.match(create, /\{short2 \? null : polishLine\}/); assert.match(create, /\{short2 \? null : autoline\}/);
});
