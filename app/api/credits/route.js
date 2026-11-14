import { NextResponse } from 'next/server';
import { setCreditsCookie, getClientIp, freeState, paidFor } from '../../../lib/credits';
import { isAdmin } from '../../../lib/admin';
import { readAccount } from '../../../lib/account';
import { getCreatorId } from '../../../lib/identity';
import { PLANS, hasPurchased } from '../../../lib/paid';
import { paymentsEnabled, planEnabled } from '../../../lib/pay';
import { modelHealth } from '../../../lib/modelHealth';
import { MODEL_TIERS, VIDEO_TIERS } from '../../../lib/models';

// Ids of models that should not be offered right now: switched off by their provider, or resting after failing
// several runs in a row. The page hides them and Auto never picks them.
async function offIds() {
  const { dead, down = new Set(), resting = {} } = await modelHealth().catch(() => ({ dead: new Set(), resting: {} }));
  if (!dead.size && !down.size && !Object.keys(resting).length) return [];
  return [...Object.entries(MODEL_TIERS), ...Object.entries(VIDEO_TIERS)].filter(([, t]) => dead.has(t.model) || down.has(t.model) || resting[t.model]).map(([id]) => id);
}

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request) {
  if (isAdmin(request)) { const a = readAccount(request); return NextResponse.json({ credits: null, admin: true, account: a ? { email: a.email } : null, off: await offIds(), now: Date.now() }); }
  const creator = getCreatorId(request);
  const account = readAccount(request);
  // Guests: a one-time trial. Signed-in accounts: a daily allowance shared by all their devices.
  const state = await freeState({ creator, ip: getClientIp(request), signedIn: Boolean(account) });
  const credits = state.remaining;
  const plans = Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, credits: p.credits, price: p.price, period: p.period, enabled: planEnabled(p.id) }));
  const res = NextResponse.json({ now: Date.now(), off: await offIds(), credits, freeLimit: state.limit, guest: state.guest, paid: await paidFor(creator), purchased: !creator.isNew && await hasPurchased(creator.id), payments: paymentsEnabled(), plans, account: account ? { email: account.email } : null });
  setCreditsCookie(res, state);
  return res;
}
