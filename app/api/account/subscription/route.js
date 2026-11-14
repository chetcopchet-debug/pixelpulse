import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { readAccount } from '../../../../lib/account';
import { subscriptionUrl } from '../../../../lib/pay';
import { rateLimit } from '../../../../lib/ratelimit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST -> { url }: the payment company's page where this account's Yelvo Pro is cancelled or its card changed.
// The subscription is the one behind the account's latest Pro payment; its id was kept with that payment.
export async function POST(request) {
  const acct = readAccount(request);
  if (!acct) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (!await rateLimit(`submanage:${acct.uid}`, 20, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 });
  const { data, error } = await sb.from('payment_events').select('order_id').eq('uid', acct.uid).eq('kind', 'pro').not('order_id', 'is', null)
    .order('created_at', { ascending: false }).limit(1);
  if (error) { console.error('Subscription lookup:', error.message); return NextResponse.json({ error: 'Service temporarily unavailable.' }, { status: 503 }); }
  if (!data?.length) return NextResponse.json({ error: 'No subscription was found for this account.' }, { status: 404 });
  const out = await subscriptionUrl({ subscription: data[0].order_id });
  if (!out.url) return NextResponse.json({ error: 'The subscription page could not be opened. Try again, or contact us.' }, { status: 502 });
  return NextResponse.json({ url: out.url });
}
