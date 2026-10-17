import { NextResponse } from 'next/server';
import { getCreatorId, setCreatorCookie } from '../../../lib/identity';
import { PLANS, planEnabled, signUidFor } from '../../../lib/paid';
import { rateLimit } from '../../../lib/ratelimit';
import { getClientIp } from '../../../lib/credits';
import { SITE_URL } from '../../../lib/site';
import { withErrorLog } from '../../../lib/monitor';
export const dynamic = 'force-dynamic';

async function POSTHandler(request) {
  const body = await request.json().catch(() => ({}));
  const plan = PLANS[body?.plan];
  if (!plan) return NextResponse.json({ error: 'Unknown plan.' }, { status: 400 });
  if (!planEnabled(plan.id)) return NextResponse.json({ error: 'Payments are coming soon.', disabled: true }, { status: 503 });
  if (!await rateLimit(`checkout:${getClientIp(request)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const creator = getCreatorId(request);
  const payload = {
    data: {
      type: 'checkouts',
      attributes: {
        checkout_data: { custom: { uid: creator.id, sig: signUidFor('pay', creator.id), plan: plan.id } },
        product_options: { redirect_url: `${SITE_URL}/?paid=1` },
      },
      relationships: {
        store: { data: { type: 'stores', id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
        variant: { data: { type: 'variants', id: String(process.env[plan.env]) } },
      },
    },
  };
  try {
    const r = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: { Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json', Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` },
      body: JSON.stringify(payload),
    });
    const d = await r.json().catch(() => ({}));
    const url = d?.data?.attributes?.url;
    if (!r.ok || !url) { console.error('LS checkout failed', r.status, JSON.stringify(d?.errors || '').slice(0, 300)); return NextResponse.json({ error: 'Checkout is unavailable right now.' }, { status: 502 }); }
    const res = NextResponse.json({ url });
    setCreatorCookie(res, creator);
    return res;
  } catch (e) {
    console.error('LS checkout error', e);
    return NextResponse.json({ error: 'Checkout is unavailable right now.' }, { status: 502 });
  }
}

export const POST = withErrorLog('/api/checkout', POSTHandler);
