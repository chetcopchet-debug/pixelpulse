import { NextResponse } from 'next/server';
import { getAuthClient as getSupabase } from '../../../../lib/supabase';
import { EMAIL_RE } from '../../../../lib/account';
import { rateLimit } from '../../../../lib/ratelimit';
import { getClientIp } from '../../../../lib/credits';
import { SITE_URL } from '../../../../lib/site';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { email } = await request.json().catch(() => ({}));
  const e = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const ip = getClientIp(request);
  if (!await rateLimit(`auth:ip:${ip}`, 6, 60 * 60_000) || !await rateLimit(`auth:em:${e}`, 4, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many codes requested. Try again in a little while.' }, { status: 429 });
  }
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
  const { error } = await sb.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true, emailRedirectTo: `${SITE_URL}/auth/callback` } });
  if (error) {
    console.error('auth start', error.status, error.message);
    const rl = /rate|limit|security purposes/i.test(error.message);
    return NextResponse.json({ error: rl ? 'Email sending is busy right now. Please try again in a few minutes.' : 'Could not send the code. Please try again.' }, { status: rl ? 429 : 502 });
  }
  return NextResponse.json({ ok: true });
}
