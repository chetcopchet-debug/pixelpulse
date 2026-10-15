import { NextResponse } from 'next/server';
import { getAuthClient as getSupabase } from '../../../../lib/supabase';
import { EMAIL_RE, linkAccount } from '../../../../lib/account';
import { paidBalance } from '../../../../lib/paid';
import { rateLimit } from '../../../../lib/ratelimit';
import { getClientIp } from '../../../../lib/credits';
export const dynamic = 'force-dynamic';

// Body: { email, code } (6-digit OTP) or { access_token } (from the magic-link callback page).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  if (!await rateLimit(`auth:verify:${getClientIp(request)}`, 15, 15 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Wait a few minutes.' }, { status: 429 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
  let user = null;
  if (typeof body.code === 'string' && body.oauth === true) {
    const verifier = request.cookies.get('pp_pkce')?.value;
    if (!verifier || body.code.length > 512) return NextResponse.json({ error: 'Google sign-in expired. Please try again.' }, { status: 400 });
    const r = await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
      method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY || '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ auth_code: body.code, code_verifier: verifier }), cache: 'no-store',
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) user = d?.user || null;
    else console.error('oauth exchange', r.status, d?.error_code || d?.error || '');
  } else if (typeof body.access_token === 'string' && body.access_token.length < 4000) {
    const { data, error } = await sb.auth.getUser(body.access_token);
    if (!error) user = data?.user || null;
  } else {
    const email = String(body.email || '').trim().toLowerCase();
    const code = String(body.code || '').replace(/\D/g, '');
    if (!EMAIL_RE.test(email) || code.length < 6 || code.length > 10) return NextResponse.json({ error: 'Enter the code from the email.' }, { status: 400 });
    const { data, error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) return NextResponse.json({ error: 'That code is wrong or expired. Request a new one.' }, { status: 400 });
    user = data?.user || null;
  }
  if (!user?.id || !user.email) return NextResponse.json({ error: 'Sign-in link expired. Request a new code.' }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  try {
    const r = await linkAccount(request, res, user);
    const out = NextResponse.json({ ok: true, email: r.email, created: r.created, merged: r.merged, paid: await paidBalance(r.uid) });
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    out.cookies.set('pp_pkce', '', { path: '/', maxAge: 0 });
    return out;
  } catch (e) {
    console.error('auth link', e);
    return NextResponse.json({ error: 'Signed in, but we could not load your account. Try again.' }, { status: 500 });
  }
}
