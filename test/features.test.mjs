import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { KEEP_FACE_ON } from '../lib/features.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('"Keep the face" is off, and one switch decides it everywhere', () => {
  assert.equal(KEEP_FACE_ON, false, 'off until the payment provider has approved the site');
  // The server turns a request down before anything else happens.
  const route = read('app/api/facelock/route.js');
  assert.ok(route.indexOf('if (!KEEP_FACE_ON) return') > 0 && route.indexOf('if (!KEEP_FACE_ON) return') < route.indexOf('return runImageTool('));
  // The action under a picture and the two price lists follow the same switch.
  for (const f of ['app/studio/next.js', 'app/studio/Pages.js', 'app/pricing/page.js']) assert.match(read(f), /KEEP_FACE_ON \? \[/, f);
});

test('the first upload on a device goes through the sheet that says what may be uploaded', () => {
  const create = read('app/studio/Create.js');
  assert.match(create, /if \(uploadAgreed\(\)\) open\(\); else s\.setSheet\(\{ type: "upload", pick: open \}\)/);
  assert.equal((create.match(/fileRef\.current\?\.click\(\)/g) || []).length, 1, 'the file picker is opened from one place only');
});
