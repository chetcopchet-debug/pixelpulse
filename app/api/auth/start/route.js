import { NextResponse } from 'next/server';
import { getAuthClient as getSupabase, getSupabase as getData } from '../../../../lib/supabase';
import { EMAIL_RE } from '../../../../lib/account';
import { rateLimit } from '../../../../lib/ratelimit';
import { getClientIp } from '../../../../lib/credits';
import { returnOrigin } from '../../../../lib/site';
import { isLang, LANG_COOKIE } from '../../../i18n/core.js';
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const { email, lang: asked } = await request.json().catch(() => ({}));
  const e = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(e)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const ip = getClientIp(request);
  if (!await rateLimit(`auth:ip:${ip}`, 6, 60 * 60_000) || !await rateLimit(`auth:em:${e}`, 4, 60 * 60_000)) {
    return NextResponse.json({ error: 'Too many sign-in emails requested. Try again in a little while.' }, { status: 429 });
  }
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
  // The email is written in the language of the site as this person sees it. The email service reads it from
  // the account (see scripts/email.mjs): a new account gets it below, an existing one is told here.
  const cookieLang = request.cookies.get(LANG_COOKIE)?.value;
  const lang = isLang(asked) ? asked : isLang(cookieLang) ? cookieLang : 'en';
  try {
    const { data: acct } = await getData().from('accounts').select('user_id').eq('email', e).maybeSingle();
    if (acct?.user_id) await getData().auth.admin.updateUserById(acct.user_id, { user_metadata: { lang } });
  } catch (err) { console.error('auth start lang', err?.message); }
  const { error } = await sb.auth.signInWithOtp({ email: e, options: { shouldCreateUser: true, data: { lang }, emailRedirectTo: `${returnOrigin(request)}/auth/callback` } });
  if (error) {
    console.error('auth start', error.status, error.message);
    const rl = /rate|limit|security purposes/i.test(error.message);
    return NextResponse.json({ error: rl ? 'Email sending is busy right now. Please try again in a few minutes.' : 'The sign-in email could not be sent. Please try again.' }, { status: rl ? 429 : 502 });
  }
  return NextResponse.json({ ok: true });
}
