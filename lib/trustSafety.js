// Trust & safety: report decisions, auto-takedown, strikes/bans, generation log.
// Pure decision helpers are exported for tests; DB helpers never throw (they log and fail safe).
import { getSupabase, BUCKET, QUARANTINE_BUCKET } from './supabase';
import { thumbPath } from './thumbs';
import { creatorTag } from './identity';
import { classifyImage } from './moderation';

export const REPORT_REASONS = {
  nonconsensual: 'Real person without consent',
  sexual: 'Sexual content',
  minor: 'Involves a minor',
  violence: 'Violence or gore',
  other: 'Something else',
};
export const URGENT_REASONS = ['minor', 'nonconsensual'];
export const HIDE_AT_REPORTERS = 2;
export const BAN_AT_STRIKES = 3;
export const SLA_HOURS = 48;
// Immediate hides triggered by ONE urgent report are capped per reporter IP per day, so a single troll cannot hide
// hundreds of items. Over the cap the report is still stored and queued; minor reports beyond the cap still hide at
// HIDE_AT_REPORTERS distinct reporters, and the classifier still runs on every reported item.
export const URGENT_HIDES_PER_IP_DAY = 5;

export function normalizeReport(body) {
  const code = typeof body?.reason === 'string' && Object.prototype.hasOwnProperty.call(REPORT_REASONS, body.reason) ? body.reason : null;
  const details = typeof body?.details === 'string' ? body.details.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500) : '';
  return { code, details };
}
// Hide immediately for urgent reasons or once enough distinct reporters agree.
export function shouldAutoHide(code, distinctReporters, { urgentAllowed = true } = {}) {
  return (urgentAllowed && URGENT_REASONS.includes(code)) || Number(distinctReporters) >= HIDE_AT_REPORTERS;
}
// Content reported as involving a minor (or already removed) must be preserved: owners cannot delete it.
export function deletionLocked(row, reportCodes = []) {
  return Boolean(row?.removed_at || row?.quarantine_path || reportCodes.includes('minor'));
}

// Select from images; if migration 010 isn't installed yet (no quarantine_path column), retry without it.
export async function selectImages(sb, cols, apply) {
  let r = await apply(sb.from('images').select(cols));
  if (r.error && /quarantine_path/.test(`${r.error.message}`)) r = await apply(sb.from('images').select(cols.replace(/,\s*quarantine_path/, '')));
  return r;
}

// Move an item's files (original + thumb) from the public bucket into the private quarantine bucket.
// Copies first and deletes the public copy only after the evidence copy succeeded. Returns true when quarantined.
export async function quarantineFiles(sb, row) {
  if (!row?.storage_path || row.quarantine_path) return Boolean(row?.quarantine_path);
  const paths = [row.storage_path, thumbPath(row.storage_path)].filter(Boolean);
  const moved = [];
  for (const p of paths) {
    const { data, error } = await sb.storage.from(BUCKET).download(p);
    if (error || !data) { if (p === row.storage_path) { console.error('quarantine download', p, error?.message); return false; } continue; }
    const { error: ue } = await sb.storage.from(QUARANTINE_BUCKET).upload(p, Buffer.from(await data.arrayBuffer()), { contentType: data.type || undefined, upsert: true });
    if (ue) { console.error('quarantine upload (migration 010 run?)', ue.message); return false; }
    moved.push(p);
  }
  const { error: de } = await sb.storage.from(BUCKET).remove(moved);
  if (de) console.error('quarantine remove public', de.message);
  await sb.from('images').update({ quarantine_path: row.storage_path }).eq('id', row.id);
  return true;
}
// Restore: copy back to the public bucket, then drop the quarantine copy.
export async function unquarantineFiles(sb, row) {
  if (!row?.quarantine_path) return true;
  const paths = [row.quarantine_path, thumbPath(row.quarantine_path)].filter(Boolean);
  for (const p of paths) {
    const { data, error } = await sb.storage.from(QUARANTINE_BUCKET).download(p);
    if (error || !data) { if (p === row.quarantine_path) { console.error('unquarantine download', error?.message); return false; } continue; }
    const { error: ue } = await sb.storage.from(BUCKET).upload(p, Buffer.from(await data.arrayBuffer()), { contentType: data.type || undefined, upsert: true });
    if (ue) { console.error('unquarantine upload', ue.message); return false; }
  }
  await sb.storage.from(QUARANTINE_BUCKET).remove(paths).catch(() => {});
  await sb.from('images').update({ quarantine_path: null }).eq('id', row.id);
  return true;
}
// Classifier result on a reported item: nsfw -> remove; anything else stays for human review.
export function classifierAction(label) {
  return label === 'nsfw' ? 'remove' : 'review';
}
export function shouldBan(strikes) { return Number(strikes) >= BAN_AT_STRIKES; }
export function slaDue(firstReportedAt) {
  const t = Date.parse(firstReportedAt || '');
  return Number.isFinite(t) ? new Date(t + SLA_HOURS * 3600_000).toISOString() : null;
}
export const isVideoRow = (row) => /\.mp4(\?|\s|$)/i.test(`${row?.storage_path || ''} ${row?.public_url || ''}`);
export const ipHash = (ip) => creatorTag(String(ip || ''), 'iplog');

export const BANNED_MSG = 'This account was suspended for breaking the Content Policy. Contact us if you think this is a mistake.';

// Banned check. Fails OPEN if the table is missing/unreachable (does not block before migration 009).
export async function isBanned(creatorId) {
  const sb = getSupabase(); if (!sb || !creatorId) return false;
  const { data, error } = await sb.from('banned_creators').select('creator_id').eq('creator_id', creatorId).maybeSingle();
  if (error) { if (!/banned_creators|42P01|PGRST205/i.test(`${error.message} ${error.code}`)) console.error('isBanned', error.message); return false; }
  return Boolean(data);
}

// Record a confirmed removal; ban the creator at BAN_AT_STRIKES. Returns { strikes, banned }.
export async function addStrike(sb, { imageId, creatorId, source }) {
  if (!creatorId) return { strikes: 0, banned: false };
  const { error } = await sb.from('moderation_strikes').upsert({ image_id: imageId, creator_id: creatorId, source }, { onConflict: 'image_id', ignoreDuplicates: true });
  if (error) { console.error('addStrike', error.message); return { strikes: 0, banned: false }; }
  const { count } = await sb.from('moderation_strikes').select('image_id', { count: 'exact', head: true }).eq('creator_id', creatorId);
  const strikes = count || 0;
  if (shouldBan(strikes)) {
    const { error: be } = await sb.from('banned_creators').upsert({ creator_id: creatorId, reason: `auto: ${strikes} confirmed removals` }, { onConflict: 'creator_id', ignoreDuplicates: true });
    if (be) console.error('ban', be.message);
    // Take the banned creator's remaining public items off the feed.
    await sb.from('images').update({ hidden: true }).eq('creator_id', creatorId).eq('is_public', true);
    return { strikes, banned: true };
  }
  return { strikes, banned: false };
}

// After a stored report: auto-hide, then (once per item) re-run the NSFW classifier and auto-remove if flagged.
export async function applyTakedown(sb, { imageId, code, distinctReporters, classify = classifyImage, urgentAllowed = true, quarantine = quarantineFiles }) {
  const out = { hidden: false, removed: false, banned: false, quarantined: false };
  const { data: row } = await selectImages(sb, 'id, creator_id, public_url, storage_path, hidden, removed_at, auto_checked_at, first_reported_at, quarantine_path', (q) => q.eq('id', imageId).maybeSingle());
  if (!row) return out;
  const patch = {};
  if (!row.first_reported_at) patch.first_reported_at = new Date().toISOString();
  const hideNow = shouldAutoHide(code, distinctReporters, { urgentAllowed });
  if (!row.hidden && hideNow) { patch.hidden = true; out.hidden = true; }
  if (Object.keys(patch).length) await sb.from('images').update(patch).eq('id', imageId);
  // Possible child-safety content: take the file itself offline (kept privately as evidence) until reviewed.
  if (hideNow && code === 'minor') out.quarantined = await quarantine(sb, row);
  if (row.removed_at || row.auto_checked_at || isVideoRow(row)) return out; // classifier runs once; videos can't be classified
  const label = await classify(row.public_url);
  if (label === 'unavailable') return out; // retry on the next report; stays in the admin queue
  const now = new Date().toISOString();
  if (classifierAction(label) === 'remove') {
    await sb.from('images').update({ hidden: true, removed_at: now, removal_reason: 'auto:nsfw', auto_checked_at: now }).eq('id', imageId);
    out.hidden = true; out.removed = true;
    out.quarantined = out.quarantined || await quarantine(sb, row);
    out.banned = (await addStrike(sb, { imageId, creatorId: row.creator_id, source: 'auto:nsfw' })).banned;
  } else {
    await sb.from('images').update({ auto_checked_at: now }).eq('id', imageId);
  }
  return out;
}

// Generation log. Never throws and never blocks the request on failure.
export async function logGeneration({ userId, ip, mode, prompt, inputRef, outputRef, moderation }) {
  try {
    const sb = getSupabase(); if (!sb) return;
    const { error } = await sb.from('generation_log').insert({
      user_id: userId || null, ip_hash: ip ? ipHash(ip) : null, mode: String(mode || 'unknown').slice(0, 40),
      prompt: typeof prompt === 'string' ? prompt.slice(0, 2000) : null,
      input_ref: inputRef ? String(inputRef).slice(0, 300) : null, output_ref: outputRef ? String(outputRef).slice(0, 300) : null,
      moderation: moderation ? String(moderation).slice(0, 80) : null,
    });
    if (error && !/generation_log|42P01|PGRST205/i.test(`${error.message} ${error.code}`)) console.error('generation_log', error.message);
  } catch (e) { console.error('generation_log', e?.message || e); }
}
