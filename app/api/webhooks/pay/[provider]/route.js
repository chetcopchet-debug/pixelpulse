import { NextResponse } from 'next/server';
import { handleWebhook } from '../../../../../lib/pay';
export const dynamic = 'force-dynamic';

// The webhook address of a payment company: /api/webhooks/pay/<id>, where <id> is its file in lib/pay.
// An unknown id is answered 404; a call whose signature does not verify is answered 401 and changes nothing.
export async function POST(request, { params }) {
  const { provider } = await params;
  const out = await handleWebhook(String(provider || ''), await request.text(), (h) => request.headers.get(h));
  return NextResponse.json(out.body, { status: out.status });
}
