import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { isAdmin } from '../../../../lib/admin';
import { getCreatorId, setCreatorCookie } from '../../../../lib/identity';
import { getSupabase } from '../../../../lib/supabase';
import { grantPaid, paidBalance } from '../../../../lib/paid';
import { rateLimit } from '../../../../lib/ratelimit';
import { EMAIL_RE } from '../../../../lib/account';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const MAX_GRANT = 2000;

// Admin only (signed admin cookie, SameSite=Strict). Adds PAID credits for testing or support:
// to the account with the given email, or, with no email, to the identity of this browser.
// Every grant is written to payment_events (kind 'admin_grant'), so there is an audit trail.
// Admin grants never count as a purchase (hasPurchased only looks at 'pack' / 'pro').
export async function POST(request) {
  const back = (q) => NextResponse.redirect(new URL(`/admin?${q}`, request.url), 303);
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!await rateLimit('admin:grant', 20, 60 * 60_000)) return back('g=rate');
  const f = await request.formData().catch(() => null);
  const amount = Math.floor(Number(f?.get('amount')));
  const email = String(f?.get('email') || '').trim().toLowerCase();
  if (!Number.isInteger(amount) || amount < 1 || amount > MAX_GRANT) return back('g=amount');
  const sb = getSupabase(); if (!sb) return back('g=db');

  let uid, creator = null;
  if (email) {
    if (!EMAIL_RE.test(email)) return back('g=email');
    const { data } = await sb.from('accounts').select('uid').eq('email', email).maybeSingle();
    if (!data?.uid) return back('g=noacct');
    uid = data.uid;
  } else {
    creator = getCreatorId(request); uid = creator.id;
  }
  try {
    await grantPaid(uid, amount, { event: `admin:${crypto.randomUUID()}`, kind: 'admin_grant' });
  } catch (e) { console.error('admin grant', e?.message || e); return back('g=db'); }
  const res = back(`g=ok&n=${amount}&b=${await paidBalance(uid)}&t=${email ? 'email' : 'device'}`);
  if (creator) setCreatorCookie(res, creator);
  return res;
}
