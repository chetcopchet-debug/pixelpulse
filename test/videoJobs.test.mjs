import test from 'node:test';
import assert from 'node:assert/strict';
import { jobOutcome, outputUrl, jobKind, jobFromRow, webhookFields, PREDICTION_ID_RE } from '../lib/videoJobCore.js';

test('outcome: still running, unreachable, finished, failed', () => {
  assert.equal(jobOutcome(null), 'unknown');
  assert.equal(jobOutcome({ status: 'starting' }), 'processing');
  assert.equal(jobOutcome({ status: 'processing' }), 'processing');
  assert.equal(jobOutcome({ status: 'succeeded', output: 'https://x/v.mp4' }), 'ready');
  assert.equal(jobOutcome({ status: 'succeeded', output: ['https://x/v.mp4'] }), 'ready');
  assert.equal(jobOutcome({ status: 'failed', error: 'boom' }), 'failed');
  assert.equal(jobOutcome({ status: 'canceled' }), 'failed');
});
test('succeeded without an output is a failure, so the credits are refunded', () => {
  assert.equal(jobOutcome({ status: 'succeeded', output: null }), 'failed');
  assert.equal(jobOutcome({ status: 'succeeded', output: [] }), 'failed');
  assert.equal(outputUrl({ output: { url: 'x' } }), null);
});
test('a stored row rebuilds the same job the browser token carried', () => {
  const job = { p: 'abc123def456', u: 'uid-1', s: null, c: 215, t: 'veo', pr: 'aurora', r: '16:9' };
  const row = { prediction_id: job.p, uid: job.u, source_id: null, cost: 215, kind: jobKind(job), prompt: 'aurora', aspect_ratio: '16:9' };
  assert.deepEqual(jobFromRow(row), job);
  assert.equal(jobKind({ e: 'melt' }), 'effect:melt');
  assert.equal(jobKind({}), 'animate');
  assert.deepEqual(jobFromRow({ prediction_id: 'p1p1p1p1', uid: 'u', source_id: 'img', cost: 15, kind: 'effect:melt' }), { p: 'p1p1p1p1', u: 'u', s: 'img', c: 15, e: 'melt' });
});
test('webhook asks Replicate for completed events only and escapes the token', () => {
  const f = webhookFields('https://site.example', 'a.b+c/d=');
  assert.equal(f.webhook, 'https://site.example/api/webhooks/replicate?job=a.b%2Bc%2Fd%3D');
  assert.deepEqual(f.webhook_events_filter, ['completed']);
});
test('prediction ids are validated before they reach a URL', () => {
  assert.ok(PREDICTION_ID_RE.test('gm3qorzdhgbfurvjtvhg6dckhu'));
  assert.ok(!PREDICTION_ID_RE.test('../models/x'));
  assert.ok(!PREDICTION_ID_RE.test(''));
});

import { hasVideoSignature, looksLikeVideo, describeBytes, MIN_VIDEO_BYTES } from '../lib/videoJobCore.js';

const mp4 = (size) => { const b = Buffer.alloc(size); b.write('ftypisom', 4, 'latin1'); return b; };

test('a real video file is recognised, anything else is not', () => {
  assert.equal(looksLikeVideo(mp4(MIN_VIDEO_BYTES)), true);
  assert.equal(looksLikeVideo(Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(MIN_VIDEO_BYTES)])), true); // WebM
  assert.equal(looksLikeVideo(mp4(200)), false, 'far too small to be a clip');
  assert.equal(looksLikeVideo(Buffer.from('<!doctype html><html><body>Not found</body></html>'.padEnd(MIN_VIDEO_BYTES, ' '))), false, 'an error page');
  assert.equal(looksLikeVideo(Buffer.from(JSON.stringify({ error: 'expired' }).padEnd(MIN_VIDEO_BYTES, ' '))), false, 'an error message');
  assert.equal(looksLikeVideo(Buffer.alloc(0)), false);
  assert.equal(looksLikeVideo(null), false);
  assert.equal(hasVideoSignature(mp4(64)), true, 'the first bytes alone are enough to tell the type');
});

test('the note about a bad file says what arrived, not its content', () => {
  const note = describeBytes(Buffer.from('<html>secret</html>'), 'text/html');
  assert.match(note, /type text\/html, 19 bytes, starts 3c68746d6c3e736563726574/);
  assert.equal(describeBytes(null), 'type unknown, 0 bytes, starts empty');
});

test('the webhook address carries the Vercel bypass secret only when there is one', () => {
  assert.equal(webhookFields('https://a.vercel.app', 'tok').webhook, 'https://a.vercel.app/api/webhooks/replicate?job=tok');
  assert.equal(webhookFields('https://a.vercel.app', 'tok', 's3 cret').webhook, 'https://a.vercel.app/api/webhooks/replicate?job=tok&x-vercel-protection-bypass=s3%20cret');
});
