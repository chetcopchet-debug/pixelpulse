import { NextResponse } from 'next/server';
import { adminEnabled, checkAdminKey, setAdminCookie } from '../../../lib/admin';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  if (!adminEnabled()) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  if (!rateLimit(`admin:ip:${getClientIp(request)}`, 10, 10 * 60_000)) {
    return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  if (!checkAdminKey(body?.key)) return NextResponse.json({ error: 'Invalid key.' }, { status: 401 });
  const res = NextResponse.json({ success: true, admin: true });
  setAdminCookie(res);
  return res;
}
