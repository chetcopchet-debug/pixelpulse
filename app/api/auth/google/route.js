import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { returnOrigin } from '../../../../lib/site';
export const dynamic = 'force-dynamic';
// Start Google sign-in (PKCE): verifier kept in a short-lived HttpOnly cookie, challenge sent to Supabase.
export async function GET(request) {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const u = new URL(`${process.env.SUPABASE_URL}/auth/v1/authorize`);
  u.searchParams.set('provider', 'google');
  u.searchParams.set('redirect_to', `${returnOrigin(request)}/auth/callback`); // back to the address the visitor is on
  u.searchParams.set('code_challenge', challenge);
  u.searchParams.set('code_challenge_method', 's256');
  const res = NextResponse.redirect(u.toString(), 302);
  res.cookies.set('pp_pkce', verifier, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  return res;
}
