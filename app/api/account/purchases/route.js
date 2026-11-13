import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { readAccount } from '../../../../lib/account';
import { PLANS } from '../../../../lib/paid';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const NAMES = { pack: PLANS.pack.name, pro: PLANS.pro.name, admin_grant: 'Added by Yelvo', referral: 'Referral bonus' };

// GET: what this account bought, newest first. Receipts themselves are emailed by the payment provider.
export async function GET(request) {
  const acct = readAccount(request);
  if (!acct) return NextResponse.json({ error: 'Sign in to see your purchases.' }, { status: 401 });
  const sb = getSupabase();
  if (!sb) return NextResponse.json({ items: [] });
  const { data, error } = await sb.from('payment_events').select('event_id, kind, credits, created_at').eq('uid', acct.uid).gt('credits', 0)
    .order('created_at', { ascending: false }).limit(100);
  if (error) { console.error('Purchases:', error.message); return NextResponse.json({ error: 'Could not load your purchases.' }, { status: 500 }); }
  const items = data.filter((r) => NAMES[r.kind]).map((r) => ({ id: r.event_id, name: NAMES[r.kind], credits: r.credits, at: r.created_at, price: PLANS[r.kind]?.price || null }));
  return NextResponse.json({ items });
}
