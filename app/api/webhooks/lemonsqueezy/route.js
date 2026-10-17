import { NextResponse } from 'next/server';
import { verifySignature, planEvent } from '../../../../lib/lsWebhook';
import { grantPaid } from '../../../../lib/paid';
import { getSupabase } from '../../../../lib/supabase';
import { trackServer, lsRevenue } from '../../../../lib/analytics';
import { withErrorLog } from '../../../../lib/monitor';
export const dynamic = 'force-dynamic';

async function POSTHandler(request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 });
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get('x-signature'), secret)) return NextResponse.json({ error: 'bad signature' }, { status: 401 });
  let evt; try { evt = JSON.parse(raw); } catch { return NextResponse.json({ error: 'bad json' }, { status: 400 }); }
  const plan = planEvent(evt);
  if (plan.action !== 'grant') return NextResponse.json({ ok: true, ignored: plan.reason });
  try {
    const bal = await grantPaid(plan.uid, plan.credits, { event: plan.event, kind: plan.kind, order: plan.order, emailHash: plan.emailHash });
    // Funnel analytics (first delivery only; never affects the credit grant or the response).
    if (bal !== null) await trackServer(getSupabase(), plan.credits > 0 ? 'purchase' : 'refund', { kind: plan.kind }, { revenueCents: lsRevenue(evt), currency: evt?.data?.attributes?.currency || null });
    return NextResponse.json({ ok: true, duplicate: bal === null });
  } catch (e) {
    console.error('LS webhook grant failed', e);
    return NextResponse.json({ error: 'retry' }, { status: 500 }); // LS retries on non-2xx
  }
}

export const POST = withErrorLog('/api/webhooks/lemonsqueezy', POSTHandler);
