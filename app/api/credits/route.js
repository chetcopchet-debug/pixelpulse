import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, COOKIE_NAME } from '../../../lib/credits';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  const credits = Math.min(state.remaining, ipRemaining(getClientIp(request)));
  const res = NextResponse.json({ credits });
  setCreditsCookie(res, state);
  return res;
}
