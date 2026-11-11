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
