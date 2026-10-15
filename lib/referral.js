// Invite friends: both get +10⚡ (paid balance) once, when a NEW account signs in through a referral link.
// Requires migration 008; every function degrades to "disabled" until it exists.
import crypto from 'crypto';
import { getSupabase } from './supabase';
import { grantPaid } from './paid';
import { getClientIp } from './credits';
import { SITE_URL } from './site';

export const REF_COOKIE = 'pp_ref';
export const REF_BONUS = 10;
export const REF_DAILY_CAP = 20;
export const CODE_RE = /^[A-Za-z0-9]{8}$/;
const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
export const ipHash = (ip) => crypto.createHmac('sha256', SECRET()).update(`refip.${ip}`).digest('hex').slice(0, 32);
const missing = (e) => /referral|relation|schema cache|42P01|PGRST205/i.test(`${e?.message} ${e?.code}`);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const newCode = () => Array.from(crypto.randomBytes(8), (b) => ALPHA[b % ALPHA.length]).join('');
export const linkFor = (code) => `${SITE_URL}/r/${code}`;

// The account's personal code (created on first use). Also remembers the referrer's latest IP for self-referral checks.
export async function codeFor(uid, request) {
  const sb = getSupabase(); if (!sb) return null;
  const ip = ipHash(getClientIp(request));
  const { data, error } = await sb.from('referral_codes').select('code').eq('uid', uid).maybeSingle();
  if (error) { if (!missing(error)) console.error('ref code', error); return null; }
  if (data) { await sb.from('referral_codes').update({ ip_hash: ip }).eq('uid', uid); return data.code; }
  for (let i = 0; i < 3; i++) {
    const code = newCode();
    const ins = await sb.from('referral_codes').insert({ code, uid, ip_hash: ip });
    if (!ins.error) return code;
    const again = await sb.from('referral_codes').select('code').eq('uid', uid).maybeSingle();
    if (again.data) return again.data.code;
  }
  return null;
}
export async function inviteCount(uid) {
  const sb = getSupabase(); if (!sb) return 0;
  const { count, error } = await sb.from('referrals').select('referee_uid', { count: 'exact', head: true }).eq('referrer_uid', uid);
  return error ? 0 : count || 0;
}

// Called right after linkAccount. Returns the bonus granted to the new user (0 if none). Always clears the cookie.
export async function rewardReferral(request, res, { uid, created }) {
  const code = request.cookies.get(REF_COOKIE)?.value || '';
  res.cookies.set(REF_COOKIE, '', { path: '/', maxAge: 0 });
  if (!created || !CODE_RE.test(code)) return 0;
  const sb = getSupabase(); if (!sb) return 0;
  try {
    const { data: ref, error } = await sb.from('referral_codes').select('uid, ip_hash').eq('code', code).maybeSingle();
    if (error || !ref || ref.uid === uid) return 0;                       // unknown code / self-referral (same account)
    const ip = ipHash(getClientIp(request));
    if (ref.ip_hash && ref.ip_hash === ip) return 0;                      // self-referral from the same network
    const since = new Date(); since.setUTCHours(0, 0, 0, 0);
    const { count } = await sb.from('referrals').select('referee_uid', { count: 'exact', head: true }).eq('referrer_uid', ref.uid).gte('created_at', since.toISOString());
    if ((count || 0) >= REF_DAILY_CAP) return 0;
    // One reward per new account and per IP (primary key + unique ip_hash make this atomic)
    const ins = await sb.from('referrals').insert({ referee_uid: uid, referrer_uid: ref.uid, ip_hash: ip });
    if (ins.error) return 0;
    await grantPaid(uid, REF_BONUS, { event: `ref:${uid}:new`, kind: 'referral' });
    await grantPaid(ref.uid, REF_BONUS, { event: `ref:${uid}:inviter`, kind: 'referral' });
    return REF_BONUS;
  } catch (e) { console.error('referral reward', e?.message || e); return 0; }
}
