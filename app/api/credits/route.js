import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, loadIpBonus, COOKIE_NAME } from '../../../lib/credits';

import { isAdmin } from '../../../lib/admin';
import { paidFor } from '../../../lib/credits';
import { getCreatorId } from '../../../lib/identity';
import { paymentsEnabled, planEnabled, PLANS } from '../../../lib/paid';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  if (isAdmin(request)) return NextResponse.json({ credits: null, admin: true });
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  await loadIpBonus(getClientIp(request));
  const credits = Math.min(state.remaining, ipRemaining(getClientIp(request)));
  const creator = getCreatorId(request);
  const plans = Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, credits: p.credits, price: p.price, period: p.period, enabled: planEnabled(p.id) }));
  const res = NextResponse.json({ credits, paid: await paidFor(creator), payments: paymentsEnabled(), plans });
  setCreditsCookie(res, state);
  return res;
}
