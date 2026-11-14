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

import { probeMp4 } from '../lib/videoJobCore.js';
import { posterUrl, thumbPath } from '../lib/thumbs.js';

// Builds a tiny but structurally real MP4: ftyp, then mdat and moov in the given order.
const box = (type, ...parts) => { const body = Buffer.concat(parts); const h = Buffer.alloc(8); h.writeUInt32BE(body.length + 8, 0); h.write(type, 4, 'latin1'); return Buffer.concat([h, body]); };
function fakeMp4({ codec = 'avc1', profile = 100, level = 30, width = 480, height = 832, indexFirst = false } = {}) {
  const entry = Buffer.alloc(78); entry.write(codec, 0, 'latin1'); entry.writeUInt16BE(width, 28); entry.writeUInt16BE(height, 30); // width and height sit 32 bytes into the entry
  const cfg = codec.startsWith('avc') ? box('avcC', Buffer.from([1, profile, 0, level, 0xff])) : Buffer.alloc(0);
  const stsd = box('stsd', Buffer.from([0, 0, 0, 0, 0, 0, 0, 1]), box(codec, entry.subarray(4), cfg));
  const moov = box('moov', box('trak', box('mdia', box('minf', box('stbl', stsd)))));
  const mdat = box('mdat', Buffer.alloc(400, 7));
  return Buffer.concat([box('ftyp', Buffer.concat([Buffer.from('isom', 'latin1'), Buffer.from([0, 0, 2, 0]), Buffer.from('isomiso2avc1mp41', 'latin1')])), ...(indexFirst ? [moov, mdat] : [mdat, moov])]);
}

test('reading what is inside a video file', () => {
  const ok = probeMp4(fakeMp4());
  assert.equal(ok.codec, 'avc1'); assert.equal(ok.profile, 100); assert.equal(ok.web, true);
  assert.deepEqual([ok.width, ok.height, ok.indexFirst], [480, 832, false]);
  assert.equal(ok.summary, 'H.264 High level 3.0, 480x832, index at the end');
  assert.equal(probeMp4(fakeMp4({ indexFirst: true })).indexFirst, true);
  assert.equal(probeMp4(fakeMp4({ profile: 66 })).web, true, 'Baseline plays everywhere');
  const p444 = probeMp4(fakeMp4({ profile: 244 }));
  assert.equal(p444.web, false, 'H.264 4:4:4 does not play on most phones'); assert.match(p444.summary, /High 4:4:4/);
  assert.equal(probeMp4(fakeMp4({ profile: 110 })).web, false, '10-bit H.264');
  const hevc = probeMp4(fakeMp4({ codec: 'hvc1' })); assert.equal(hevc.web, false); assert.match(hevc.summary, /H\.265/);
  assert.equal(probeMp4(fakeMp4({ codec: 'av01' })).web, null, 'depends on the device: not judged');
  assert.equal(probeMp4(Buffer.from('<html>not a video</html>')).summary, 'not an MP4 file');
});

test('a video poster lives where an image thumbnail would', () => {
  assert.equal(posterUrl('https://x.supabase.co/storage/v1/object/public/images/i/abc123.mp4'), 'https://x.supabase.co/storage/v1/object/public/images/t/abc123.webp');
  assert.equal(posterUrl('https://x.supabase.co/storage/v1/object/public/images/i/abc123.webp'), null);
  assert.equal(thumbPath('i/abc123.mp4'), 't/abc123.webp');
  assert.equal(thumbPath('i/abc123.png'), 't/abc123.webp');
  assert.equal(thumbPath('elsewhere/abc.mp4'), null);
});

// ---- a model that turns down realistic faces ----
test('a refusal of a realistic face is recognised, from the model\'s answer and from the stored reason', async () => {
  const { refusedFaces, FACES_REFUSED } = await import('../lib/videoJobCore.js');
  const seedance = 'Prediction failed: Async prediction failed: ModelError: The input or output was flagged as sensitive. Please try again with different inputs. (E005) (uIJ6l3ruRD): Failed to generate video: {"error":{"code":"InputImageSensitiveContentDetected.PrivacyInformation","message":"…"}}';
  assert.equal(refusedFaces(seedance), true);
  assert.equal(refusedFaces(`${FACES_REFUSED}: ${seedance}`.slice(0, 300)), true, 'the reason as it is stored (cut at 300 letters)');
  // Other refusals are not about faces.
  for (const why of ['The request failed because the output audio may be related to copyright restrictions.', 'The input or output was flagged as sensitive. (E005)', 'CUDA out of memory', 'Blocked by the safety check: the video looks explicit.', '', null]) assert.equal(refusedFaces(why), false, String(why));
});

test('the model offered after a face refusal: takes a picture, takes faces, is not the same one and is not switched off', async () => {
  const { faceAlternative, VIDEO_NO_FACES, VIDEO_FOR_FACES, videoTakesImage, VIDEO_PRICING } = await import('../lib/videoPricing.js');
  assert.equal(faceAlternative('seedance-25'), 'kling-4-flash');
  assert.equal(faceAlternative('seedance-25', new Set(['kling-4-flash'])), 'veo');
  assert.equal(faceAlternative('seedance-25', ['kling-4-flash', 'veo']), 'h3-lite');
  assert.equal(faceAlternative('seedance-25', VIDEO_FOR_FACES), null, 'nothing to offer when all of them are off');
  assert.equal(faceAlternative('kling-4-flash'), 'veo', 'never the model that just refused');
  for (const id of VIDEO_FOR_FACES) { assert.ok(VIDEO_PRICING[id], id); assert.ok(videoTakesImage(id), id); assert.ok(!VIDEO_NO_FACES.includes(id), id); }
});

test('the screen is told about a face refusal, in words every language has', async () => {
  const { readFileSync } = await import('node:fs');
  const route = readFileSync(new URL('../app/api/animate/route.js', import.meta.url), 'utf8');
  const { SERVER_MESSAGES } = await import('../app/i18n/serverMessages.js');
  const said = "This model doesn't accept realistic faces, even AI-made ones.";
  assert.ok(route.includes(said) && SERVER_MESSAGES.includes(said));
  assert.match(route, /out\.faces \? \{ faces: true \}/);
});
