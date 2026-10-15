import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, loadIpBonus, COOKIE_NAME } from '../../../lib/credits';

import { isAdmin } from '../../../lib/admin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  if (isAdmin(request)) return NextResponse.json({ credits: null, admin: true });
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  await loadIpBonus(getClientIp(request));
  const credits = Math.min(state.remaining, ipRemaining(getClientIp(request)));
  const res = NextResponse.json({ credits });
  setCreditsCookie(res, state);
  return res;
}
