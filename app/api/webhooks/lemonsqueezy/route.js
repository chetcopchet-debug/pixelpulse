import { NextResponse } from 'next/server';
import { handleWebhook } from '../../../../lib/pay';
export const dynamic = 'force-dynamic';

// Lemon Squeezy calls this address (it is the one set in its dashboard). The work is done in lib/pay/index.js,
// the same for every payment company; a new company's webhook goes to /api/webhooks/pay/<id>.
export async function POST(request) {
  const out = await handleWebhook('lemonsqueezy', await request.text(), (h) => request.headers.get(h));
  return NextResponse.json(out.body, { status: out.status });
}
