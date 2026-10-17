import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';
import { ipKey } from '../../../lib/analytics';
import { reportError } from '../../../lib/monitor';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST { message, stack?, route?, kind? } from the browser (window.onerror, unhandledrejection, error boundaries).
export async function POST(request) {
  const done = () => new NextResponse(null, { status: 204 });
  const sb = getSupabase(); if (!sb) return done();
  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > 8000) return done();
  let b; try { b = JSON.parse(raw); } catch { return done(); }
  if (typeof b?.message !== 'string' || !b.message.trim()) return done();
  if (!await rateLimit(`err:${ipKey(getClientIp(request))}`, 30, 10 * 60_000)) return done();
  const kind = ['onerror', 'rejection', 'boundary', 'global'].includes(b.kind) ? b.kind : 'client';
  await reportError({
    source: 'client',
    route: `${kind} ${typeof b.route === 'string' ? b.route : ''}`.trim(),
    message: b.message,
    stack: typeof b.stack === 'string' ? b.stack : '',
    release: typeof b.release === 'string' ? b.release.replace(/[^\w.-]/g, '').slice(0, 40) : null,
  }, sb);
  return done();
}
