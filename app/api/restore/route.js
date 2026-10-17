// Purchase recovery without login: a signed restore code moves this device onto the buyer's identity.
import { NextResponse } from 'next/server';
import { getCreatorId, setCreatorCookie } from '../../../lib/identity';
import { signUidFor, verifyUidFor, paidBalance } from '../../../lib/paid';
import { rateLimit } from '../../../lib/ratelimit';
import { getClientIp } from '../../../lib/credits';
import { withErrorLog } from '../../../lib/monitor';
export const dynamic = 'force-dynamic';

async function GETHandler(request) {
  const c = getCreatorId(request);
  if (c.isNew) return NextResponse.json({ code: null });
  const paid = await paidBalance(c.id);
  return NextResponse.json({ code: paid > 0 ? `PP-${c.id}.${signUidFor('restore', c.id)}` : null, paid }, { headers: { 'Cache-Control': 'no-store' } });
}
async function POSTHandler(request) {
  if (!await rateLimit(`restore:${getClientIp(request)}`, 10, 60 * 60_000)) return NextResponse.json({ error: 'Too many attempts.' }, { status: 429 });
  const { code } = await request.json().catch(() => ({}));
  const m = /^PP-([0-9a-f-]{36})\.([A-Za-z0-9_-]+)$/.exec(String(code || '').trim());
  if (!m || !verifyUidFor('restore', m[1], m[2])) return NextResponse.json({ error: 'That restore code is not valid.' }, { status: 400 });
  const res = NextResponse.json({ ok: true, paid: await paidBalance(m[1]) });
  setCreatorCookie(res, { id: m[1], isNew: false }, true);
  return res;
}

export const GET = withErrorLog('/api/restore', GETHandler);
export const POST = withErrorLog('/api/restore', POSTHandler);
