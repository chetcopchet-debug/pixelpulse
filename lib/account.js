// Email accounts (Supabase Auth, passwordless). The account maps to ONE canonical creator uid;
// signing in sets pp_uid to that uid on this device, so all existing uid-keyed data just works.
import crypto from 'crypto';
import { getSupabase } from './supabase';
import { getCreatorId, setCreatorCookie } from './identity';

export const ACCT_COOKIE = 'pp_acct';
const SECRET = () => process.env.CREDITS_SECRET || process.env.ADMIN_KEY || '';
const sign = (p) => crypto.createHmac('sha256', SECRET()).update(`acct.${p}`).digest('base64url');
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,24}$/i;

// Returns { email, uid } if the signed account cookie matches the current pp_uid, else null.
export function readAccount(request) {
  const v = request.cookies.get(ACCT_COOKIE)?.value || '';
  const [e, uid, sig] = v.split('.');
  if (!e || !uid || !sig || !SECRET()) return null;
  const exp = sign(`${e}.${uid}`);
  const a = Buffer.from(sig), b = Buffer.from(exp);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const creator = getCreatorId(request);
  if (creator.isNew || creator.id !== uid) return null;
  return { email: Buffer.from(e, 'base64url').toString('utf8'), uid };
}
export function setAccountCookie(res, email, uid) {
  const e = Buffer.from(email).toString('base64url');
  res.cookies.set(ACCT_COOKIE, `${e}.${uid}.${sign(`${e}.${uid}`)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 });
}
export function clearAccountCookie(res) { res.cookies.set(ACCT_COOKIE, '', { path: '/', maxAge: 0 }); }

// Link a verified Supabase user to this device. Returns { uid, merged, created }.
export async function linkAccount(request, res, user) {
  const sb = getSupabase(); if (!sb) throw new Error('db');
  const email = String(user.email || '').toLowerCase();
  const device = getCreatorId(request);
  const { data: acct, error } = await sb.from('accounts').select('uid').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(error.message);
  let uid, merged = 0, created = false;
  if (acct) {
    uid = acct.uid;
    if (!device.isNew && device.id !== uid) {
      const r = await sb.rpc('merge_uid', { p_from: device.id, p_to: uid });
      if (r.error) throw new Error(r.error.message);
      merged = Number(r.data) || 0;
    }
    await sb.from('accounts').update({ last_login: new Date().toISOString(), email }).eq('user_id', user.id);
  } else {
    uid = device.isNew ? crypto.randomUUID() : device.id;
    const ins = await sb.from('accounts').insert({ user_id: user.id, uid, email });
    if (ins.error) {
      // race: another device created it first -> retry as existing
      const again = await sb.from('accounts').select('uid').eq('user_id', user.id).maybeSingle();
      if (!again.data) throw new Error(ins.error.message);
      uid = again.data.uid;
      if (!device.isNew && device.id !== uid) await sb.rpc('merge_uid', { p_from: device.id, p_to: uid });
    } else created = true;
  }
  setCreatorCookie(res, { id: uid, isNew: false }, true);
  setAccountCookie(res, email, uid);
  return { uid, merged, created, email };
}
