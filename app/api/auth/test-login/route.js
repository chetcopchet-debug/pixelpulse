import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { linkAccount } from '../../../../lib/account';
import { rateLimit } from '../../../../lib/ratelimit';
import { getClientIp } from '../../../../lib/credits';
import { doorExists, doorOpens, TEST_EMAIL, TEST_EMAIL_PLAIN } from '../../../../lib/testDoor';
export const dynamic = 'force-dynamic';

const notFound = () => new NextResponse(null, { status: 404 });

// Asking any other way gets the same "not found", so the address never looks like one that exists.
export { notFound as GET, notFound as HEAD, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as OPTIONS };

// Signs this browser in as the test account. See lib/testDoor.js for when this exists at all.
export async function POST(request) {
  if (!doorExists(process.env)) return notFound();
  if (!await rateLimit(`testdoor:${getClientIp(request)}`, 20, 60 * 60_000)) return notFound();
  if (!doorOpens(process.env, request.headers.get('x-test-login'))) return notFound();
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Sign-in is unavailable.' }, { status: 503 });
  try {
    // The account is made the first time the door is used. Making a sign-in link returns the person (and
    // creates them when new) without sending any email.
    let user = null;
    const email = request.headers.get('x-test-account') === 'plain' ? TEST_EMAIL_PLAIN : TEST_EMAIL;
    const link = await sb.auth.admin.generateLink({ type: 'magiclink', email });
    user = link.data?.user || null;
    if (!user?.id) {
      const made = await sb.auth.admin.createUser({ email, email_confirm: true });
      user = made.data?.user || null;
      if (!user?.id) throw new Error(link.error?.message || made.error?.message || 'no test account');
    }
    const res = NextResponse.json({ ok: true });
    const r = await linkAccount(request, res, user);
    const out = NextResponse.json({ ok: true, email: r.email, created: r.created });
    res.cookies.getAll().forEach((c) => out.cookies.set(c));
    return out;
  } catch (e) {
    console.error('test door', e?.message);
    return NextResponse.json({ error: 'The test account could not be opened.' }, { status: 500 });
  }
}
