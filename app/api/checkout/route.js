import { NextResponse } from 'next/server';
import { getCreatorId, setCreatorCookie } from '../../../lib/identity';
import { PLANS } from '../../../lib/paid';
import { planEnabled, startCheckout } from '../../../lib/pay';
import { rateLimit } from '../../../lib/ratelimit';
import { getClientIp } from '../../../lib/credits';
import { readAccount } from '../../../lib/account';
export const dynamic = 'force-dynamic';

// POST { plan } -> { url }: the payment company's page for that plan (lib/pay/index.js decides which company).
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const plan = Object.prototype.hasOwnProperty.call(PLANS, body?.plan) ? PLANS[body.plan] : null;
  if (!plan) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  if (!planEnabled(plan.id)) return NextResponse.json({ error: 'Payments are coming soon.', disabled: true }, { status: 503 });
  // Only a signed-in account can buy, so the credits are saved to an account and never to one browser.
  if (!readAccount(request)) return NextResponse.json({ error: 'Sign in first, then buy. Your credits are saved to your account.', needSignIn: true }, { status: 401 });
  if (!await rateLimit(`checkout:${getClientIp(request)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const creator = getCreatorId(request);
  const out = await startCheckout({ plan, uid: creator.id });
  if (!out.url) return NextResponse.json({ error: 'Checkout is unavailable right now.' }, { status: 502 });
  const res = NextResponse.json({ url: out.url });
  setCreatorCookie(res, creator);
  return res;
}
