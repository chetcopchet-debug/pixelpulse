// Trust & safety: report decisions, auto-takedown, strikes/bans, generation log.
// Pure decision helpers are exported for tests; DB helpers never throw (they log and fail safe).
import { getSupabase } from './supabase';
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

export function normalizeReport(body) {
  const code = typeof body?.reason === 'string' && Object.prototype.hasOwnProperty.call(REPORT_REASONS, body.reason) ? body.reason : null;
  const details = typeof body?.details === 'string' ? body.details.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 500) : '';
  return { code, details };
}
// Hide immediately for urgent reasons or once enough distinct reporters agree.
export function shouldAutoHide(code, distinctReporters) {
  return URGENT_REASONS.includes(code) || Number(distinctReporters) >= HIDE_AT_REPORTERS;
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
export async function applyTakedown(sb, { imageId, code, distinctReporters, classify = classifyImage }) {
  const out = { hidden: false, removed: false, banned: false };
  const { data: row } = await sb.from('images').select('id, creator_id, public_url, storage_path, hidden, removed_at, auto_checked_at, first_reported_at').eq('id', imageId).maybeSingle();
  if (!row) return out;
  const patch = {};
  if (!row.first_reported_at) patch.first_reported_at = new Date().toISOString();
  if (!row.hidden && shouldAutoHide(code, distinctReporters)) { patch.hidden = true; out.hidden = true; }
  if (Object.keys(patch).length) await sb.from('images').update(patch).eq('id', imageId);
  if (row.removed_at || row.auto_checked_at || isVideoRow(row)) return out; // classifier runs once; videos can't be classified
  const label = await classify(row.public_url);
  if (label === 'unavailable') return out; // retry on the next report; stays in the admin queue
  const now = new Date().toISOString();
  if (classifierAction(label) === 'remove') {
    await sb.from('images').update({ hidden: true, removed_at: now, removal_reason: 'auto:nsfw', auto_checked_at: now }).eq('id', imageId);
    out.hidden = true; out.removed = true;
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
