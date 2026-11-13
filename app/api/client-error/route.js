import { NextResponse } from 'next/server';
import { noteError } from '../../../lib/errorLog';
import { rateLimit } from '../../../lib/ratelimit';
import { getClientIp } from '../../../lib/credits';

export const dynamic = 'force-dynamic';

// POST { message, where }: the page reports an error that happened in the browser. Only the cleaned message is
// counted (lib/errorLog.js): nothing about the person, the prompt or the page address is kept.
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === 'string' ? body.message.slice(0, 300) : '';
  if (!message) return NextResponse.json({ ok: true });
  if (!await rateLimit(`cerr:${getClientIp(request)}`, 20, 60 * 60_000)) return NextResponse.json({ ok: true });
  noteError('browser', `${typeof body?.where === 'string' ? body.where.slice(0, 20) : ''} ${message}`);
  return NextResponse.json({ ok: true });
}
