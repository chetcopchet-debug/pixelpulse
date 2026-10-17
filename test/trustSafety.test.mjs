import test from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, next) {
  try { return await next(s, c); } catch (e) { if (s.startsWith('.') && !/\\.m?js$/.test(s)) return next(s + '.js', c); throw e; } }`));
const { normalizeReport, shouldAutoHide, classifierAction, shouldBan, slaDue, isVideoRow, applyTakedown, REPORT_REASONS } = await import('../lib/trustSafety.js');

test('normalizeReport accepts only known reasons and caps details', () => {
  assert.equal(normalizeReport({ reason: 'minor' }).code, 'minor');
  assert.equal(normalizeReport({ reason: 'spam' }).code, null);
  assert.equal(normalizeReport({ reason: '__proto__' }).code, null);
  assert.equal(normalizeReport({}).code, null);
  assert.equal(normalizeReport({ reason: 'other', details: 'x'.repeat(900) }).details.length, 500);
  assert.equal(normalizeReport({ reason: 'other', details: 'a\nb' }).details, 'a b');
  assert.deepEqual(Object.keys(REPORT_REASONS).sort(), ['minor', 'nonconsensual', 'other', 'sexual', 'violence']);
});

test('auto-hide: urgent reasons immediately, others at 2 distinct reporters', () => {
  assert.equal(shouldAutoHide('minor', 1), true);
  assert.equal(shouldAutoHide('nonconsensual', 1), true);
  assert.equal(shouldAutoHide('sexual', 1), false);
  assert.equal(shouldAutoHide('other', 2), true);
  assert.equal(shouldAutoHide('violence', 3), true);
});

test('classifier, ban threshold, SLA, video detection', () => {
  assert.equal(classifierAction('nsfw'), 'remove');
  assert.equal(classifierAction('normal'), 'review');
  assert.equal(classifierAction('unavailable'), 'review');
  assert.equal(shouldBan(2), false); assert.equal(shouldBan(3), true);
  assert.equal(slaDue('2026-10-16T00:00:00.000Z'), '2026-10-18T00:00:00.000Z');
  assert.equal(slaDue(null), null);
  assert.equal(isVideoRow({ storage_path: 'i/a.mp4' }), true);
  assert.equal(isVideoRow({ storage_path: 'i/a.webp' }), false);
});

// Minimal in-memory fake of the Supabase query builder used by applyTakedown/addStrike.
function fakeDb(tables) {
  const from = (t) => {
    const st = { t, filters: [], op: 'select', patch: null, head: false };
    const rows = () => (tables[t] ||= []).filter((r) => st.filters.every(([k, v]) => r[k] === v));
    const q = {
      select(_c, o) { if (o?.head) st.head = true; return q; },
      eq(k, v) { st.filters.push([k, v]); return q; },
      update(p) { st.op = 'update'; st.patch = p; return q; },
      upsert(r, o) { const key = o.onConflict; if (!(tables[t] ||= []).some((x) => x[key] === r[key])) tables[t].push({ ...r }); return Promise.resolve({ error: null }); },
      maybeSingle() { return Promise.resolve({ data: rows()[0] || null, error: null }); },
      then(res) {
        if (st.op === 'update') { rows().forEach((r) => Object.assign(r, st.patch)); return res({ error: null }); }
        return res(st.head ? { count: rows().length, error: null } : { data: rows(), error: null });
      },
    };
    return q;
  };
  return { from };
}

test('applyTakedown: urgent report hides; nsfw removes; 3 strikes bans', async () => {
  const mk = (id) => ({ id, creator_id: 'c1', public_url: `https://x/${id}.webp`, storage_path: `i/${id}.webp`, hidden: false, is_public: true });
  const db = { images: [mk('a'), mk('b'), mk('c'), mk('d')] };
  const sb = fakeDb(db);
  const qd = []; const quarantine = async (_sb, row) => { qd.push(row.id); return true; };
  const r1 = await applyTakedown(sb, { imageId: 'a', code: 'minor', distinctReporters: 1, classify: async () => 'normal', quarantine });
  assert.deepEqual(r1, { hidden: true, removed: false, banned: false, quarantined: true });
  assert.ok(db.images[0].first_reported_at && db.images[0].auto_checked_at && !db.images[0].removed_at);
  const r2 = await applyTakedown(sb, { imageId: 'b', code: 'sexual', distinctReporters: 1, classify: async () => 'unavailable', quarantine });
  assert.equal(r2.hidden, false); assert.equal(db.images[1].auto_checked_at, undefined);
  for (const id of ['b', 'c']) assert.equal((await applyTakedown(sb, { imageId: id, code: 'sexual', distinctReporters: 1, classify: async () => 'nsfw', quarantine })).banned, false);
  const r4 = await applyTakedown(sb, { imageId: 'd', code: 'other', distinctReporters: 1, classify: async () => 'nsfw', quarantine });
  assert.equal(r4.removed, true); assert.equal(r4.quarantined, true);
  assert.deepEqual(qd, ['a', 'b', 'c', 'd'], 'minor hide and every removal quarantine the file'); assert.equal(r4.banned, true);
  assert.equal(db.banned_creators.length, 1);
  assert.ok(db.images.every((i) => i.hidden));
  let calls = 0; // classifier runs only once per item
  await applyTakedown(sb, { imageId: 'a', code: 'other', distinctReporters: 2, classify: async () => { calls++; return 'nsfw'; }, quarantine });
  assert.equal(calls, 0);
});
