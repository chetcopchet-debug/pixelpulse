import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.m?js$/.test(s)) return next(s + '.js', c); throw e; } }`));
const { makeDeadline, preferWait, once } = await import('../lib/deadline.js');
const { verifyReplicateSignature, webhookUrl, webhookFields, advanceJob, rowToJob, jobToRow } = await import('../lib/videoJobs.js');
const { validateUploadRequest } = await import('../lib/uploads.js');
const { shouldAutoHide, deletionLocked, applyTakedown, URGENT_HIDES_PER_IP_DAY } = await import('../lib/trustSafety.js');
const { blockedMessage, SAFETY_BUSY_MSG } = await import('../lib/moderation.js');
const { PAUSED_MSG } = await import('../lib/usage.js');
const src = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const HEB = /[\u0590-\u05FF]/;

test('deadline budget: steps get what is left minus the reserve', () => {
  let t = 0; const dl = makeDeadline(50_000, () => t);
  assert.equal(dl.budget(15_000, 6000), 15_000);
  t = 40_000; assert.equal(dl.left(), 10_000); assert.equal(dl.budget(15_000, 6000), 4000);
  t = 49_000; assert.equal(dl.budget(15_000, 6000), 0);
  t = 60_000; assert.equal(dl.left(), 0);
  assert.equal(preferWait(29_500), 29); assert.equal(preferWait(200), 1); assert.equal(preferWait(999_999), 60);
});

test('once(): a refund runs at most once', async () => {
  let n = 0; const r = once(async () => { n++; });
  await r(); await r(); await r();
  assert.equal(n, 1);
});

test('generate and image tools refund in finally and use the deadline', () => {
  for (const f of ['app/api/generate/route.js', 'lib/imagetool.js']) {
    const s = src(f);
    assert.match(s, /makeDeadline\(\)/, f); assert.match(s, /finally \{\s*if \(!finished\) await refund\(\)/, f); assert.match(s, /refund = once\(/, f);
  }
  assert.match(src('lib/generation.js'), /cancelReplicate\(prediction\.id/);
  assert.match(src('lib/replicate.js'), /cancelReplicate\(p\.id/);
});

function sign(secret, id, ts, body) {
  return crypto.createHmac('sha256', Buffer.from(secret.replace(/^whsec_/, ''), 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
}
test('Replicate webhook signature (Standard Webhooks)', () => {
  const secret = 'whsec_' + Buffer.from('k'.repeat(24)).toString('base64');
  const now = 1_800_000_000_000, ts = String(now / 1000), body = '{"id":"abc"}';
  const good = `v1,${sign(secret, 'msg_1', ts, body)}`;
  assert.equal(verifyReplicateSignature({ id: 'msg_1', timestamp: ts, signature: `v1,bogus ${good}`, body, secret, now }), true);
  assert.equal(verifyReplicateSignature({ id: 'msg_1', timestamp: ts, signature: good, body: body + ' ', secret, now }), false);
  assert.equal(verifyReplicateSignature({ id: 'msg_2', timestamp: ts, signature: good, body, secret, now }), false);
  assert.equal(verifyReplicateSignature({ id: 'msg_1', timestamp: ts, signature: good, body, secret, now: now + 3600_000 }), false, 'replay window');
  assert.equal(verifyReplicateSignature({ id: 'msg_1', timestamp: ts, signature: good, body, secret: '', now }), false);
});

test('webhook URL only for public https hosts', () => {
  assert.equal(webhookUrl({ NEXT_PUBLIC_SITE_URL: 'https://pixelpulse.app/' }), 'https://pixelpulse.app/api/webhooks/replicate');
  assert.equal(webhookUrl({ REPLICATE_WEBHOOK_BASE_URL: 'http://localhost:3000' }), null);
  assert.deepEqual(webhookFields({ NEXT_PUBLIC_SITE_URL: 'https://a.b' }).webhook_events_filter, ['completed']);
});

test('job <-> row mapping round-trips', () => {
  const j = { p: 'pred1', u: 'u1', s: null, c: 15, e: 'anime', t: undefined, pr: undefined, r: undefined };
  assert.deepEqual(rowToJob(jobToRow(j)), j);
});

// Fake Supabase for advanceJob: images + video_jobs with select/update/in/neq chains.
function fakeDb(tables) {
  return { from(t) {
    const st = { f: [], op: 'select', patch: null };
    const rows = () => (tables[t] ||= []).filter((r) => st.f.every((fn) => fn(r)));
    const q = {
      select() { if (st.op === 'update') st.ret = true; return q; },
      eq(k, v) { st.f.push((r) => r[k] === v); return q; },
      neq(k, v) { st.f.push((r) => r[k] !== v); return q; },
      in(k, v) { st.f.push((r) => v.includes(r[k])); return q; },
      update(p) { st.op = 'update'; st.patch = p; return q; },
      maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      then(res, rej) {
        if (st.op === 'update') { const m = rows(); m.forEach((r) => Object.assign(r, st.patch)); return Promise.resolve({ data: m.map((r) => ({ pred_id: r.pred_id })), error: null }).then(res, rej); }
        return Promise.resolve({ data: rows(), error: null }).then(res, rej);
      },
    };
    return q;
  } };
}
test('advanceJob: a failed prediction is refunded exactly once (webhook + poll race)', async () => {
  const db = { images: [], video_jobs: [{ pred_id: 'p1', uid: 'not-a-uuid', cost: 15, status: 'processing', updated_at: new Date().toISOString() }] };
  const sb = fakeDb(db);
  const job = rowToJob(db.video_jobs[0]);
  const a = await advanceJob(sb, job, { status: 'failed', error: 'x' });
  const b = await advanceJob(sb, job, { status: 'failed', error: 'x' });
  assert.equal(a.status, 'failed'); assert.equal(b.status, 'failed');
  assert.equal(db.video_jobs[0].status, 'refunded');
});
test('advanceJob: already saved video is returned as done', async () => {
  const db = { images: [], video_jobs: [] };
  const { pathFor } = await import('../lib/videoJobs.js');
  db.images.push({ id: 'img1', storage_path: pathFor('p2'), public_url: 'https://x/v.mp4' });
  const r = await advanceJob(fakeDb(db), { p: 'p2', u: 'u', c: 0 }, null);
  assert.equal(r.status, 'done'); assert.equal(r.item.id, 'img1');
});

test('upload request validation', () => {
  assert.equal(validateUploadRequest({ size: 1000, type: 'image/heic' }), null);
  assert.equal(validateUploadRequest({ size: 1000, type: '' }), null);
  assert.equal(validateUploadRequest({ size: 1000 }), null);
  assert.equal(validateUploadRequest({ size: 0 }).status, 400);
  assert.equal(validateUploadRequest({}).status, 400);
  assert.equal(validateUploadRequest({ size: 9 * 1024 * 1024 }).status, 413);
  assert.equal(validateUploadRequest({ size: 1000, type: 'application/zip' }).status, 415);
  assert.equal(validateUploadRequest({ size: 1000, type: 'text/html' }).status, 415);
});

test('report spam cap: over the per-IP cap a single urgent report no longer hides, 2 reporters still do', () => {
  assert.ok(URGENT_HIDES_PER_IP_DAY >= 3);
  assert.equal(shouldAutoHide('minor', 1, { urgentAllowed: false }), false);
  assert.equal(shouldAutoHide('minor', 2, { urgentAllowed: false }), true);
  assert.equal(shouldAutoHide('minor', 1), true);
  assert.match(src('app/api/report/route.js'), /urgenthide:\$\{ip\}/);
});

test('owners cannot delete removed / minor-reported items', () => {
  assert.equal(deletionLocked({ removed_at: '2026-10-17' }), true);
  assert.equal(deletionLocked({ quarantine_path: 'i/a.webp' }), true);
  assert.equal(deletionLocked({}, ['minor']), true);
  assert.equal(deletionLocked({}, ['sexual']), false);
  assert.match(src('app/api/delete/route.js'), /deletionLocked\(/);
});

test('admin remove quarantines; restore un-quarantines', () => {
  const s = src('app/api/admin/reports/route.js');
  assert.match(s, /case 'remove'[\s\S]*quarantineFiles\(sb, row\)/);
  assert.match(s, /case 'restore'[\s\S]*unquarantineFiles\(sb, row\)/);
});

test('no Hebrew in user-facing messages', () => {
  assert.ok(!HEB.test(blockedMessage('x'))); assert.ok(!HEB.test(SAFETY_BUSY_MSG)); assert.ok(!HEB.test(PAUSED_MSG));
  for (const f of ['app/api/generate/route.js', 'app/api/animate/route.js', 'lib/usage.js', 'lib/imagetool.js']) assert.ok(!HEB.test(src(f)), f);
});

test('real-person routes fail closed when translation fails; t2v checks the original too', () => {
  for (const f of ['edit', 'facelock', 'repaint']) {
    const s = src(`app/api/${f}/route.js`);
    assert.match(s, /strict: true/, f); assert.match(s, /TRANSLATE_BUSY_MSG/, f);
  }
  assert.match(src('app/api/animate/route.js'), /checkPromptText\(raw\) \|\| checkPromptText\(en\)/);
  assert.match(src('lib/translate.js'), /return strict \? null : original/);
});

test('feed never falls back to showing hidden items', () => {
  const s = src('app/api/feed/route.js');
  assert.match(s, /q = q\.eq\('hidden', false\)/); assert.ok(!/hideFilter/.test(s));
});
