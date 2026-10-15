import { NextResponse } from 'next/server';
import { REF_COOKIE, CODE_RE } from '../../../lib/referral';
export const dynamic = 'force-dynamic';
// Invite link: remember the code for 30 days, then open the studio.
export async function GET(request, { params }) {
  const { code } = await params;
  const res = NextResponse.redirect(new URL('/?invited=1', request.url), 302);
  if (CODE_RE.test(code || '')) res.cookies.set(REF_COOKIE, code, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
  return res;
}
