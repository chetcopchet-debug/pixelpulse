import { NextResponse } from 'next/server';
import { isAdmin } from '../../../../lib/admin';
import { setBalance, balanceEstimate } from '../../../../lib/balance';

export const dynamic = 'force-dynamic';

// POST { usd }: the owner types in the Replicate balance, as Replicate's billing page shows it. Admin only.
// From then on /admin shows an estimate of what is left (lib/balance.js).
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const usd = Number(body?.usd);
  if (!Number.isFinite(usd) || usd < 0 || usd > 100000) return NextResponse.json({ error: 'Type the balance in dollars, for example 25.' }, { status: 400 });
  await setBalance(usd);
  return NextResponse.json({ ok: true, estimate: await balanceEstimate() });
}
