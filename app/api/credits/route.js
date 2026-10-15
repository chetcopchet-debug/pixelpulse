import { NextResponse } from 'next/server';
import { readCreditsCookie, setCreditsCookie, getClientIp, ipRemaining, loadIpBonus, COOKIE_NAME } from '../../../lib/credits';

import { isAdmin } from '../../../lib/admin';
import { paidFor, uidRemaining } from '../../../lib/credits';
import { readAccount } from '../../../lib/account';
import { getCreatorId } from '../../../lib/identity';
import { paymentsEnabled, planEnabled, PLANS } from '../../../lib/paid';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  if (isAdmin(request)) { const a = readAccount(request); return NextResponse.json({ credits: null, admin: true, account: a ? { email: a.email } : null }); }
  const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
  await loadIpBonus(getClientIp(request));
  const creator = getCreatorId(request);
  if (!creator.isNew) state.remaining = Math.min(state.remaining, await uidRemaining(creator.id));
  const credits = Math.min(state.remaining, ipRemaining(getClientIp(request)));
  const account = readAccount(request);
  const plans = Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, credits: p.credits, price: p.price, period: p.period, enabled: planEnabled(p.id) }));
  const res = NextResponse.json({ credits, paid: await paidFor(creator), payments: paymentsEnabled(), plans, account: account ? { email: account.email } : null });
  setCreditsCookie(res, state);
  return res;
}
