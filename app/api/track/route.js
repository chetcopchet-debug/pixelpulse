import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';
import { isAdmin } from '../../../lib/admin';
import { sanitizeEvent, logEvent, dailyAnonId, ipKey, refHost } from '../../../lib/analytics';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST { name, props } — first-party funnel event (sent with navigator.sendBeacon). Always answers 204 so it never
// shows errors in the browser; invalid / rate-limited / admin events are silently dropped.
export async function POST(request) {
  const done = () => new NextResponse(null, { status: 204 });
  const sb = getSupabase(); if (!sb) return done();
  const raw = await request.text().catch(() => '');
  if (!raw || raw.length > 2000) return done();
  let body; try { body = JSON.parse(raw); } catch { return done(); }
  const evt = sanitizeEvent(body);
  if (!evt) return done();
  if (isAdmin(request)) return done(); // keep your own testing out of the numbers
  const ip = getClientIp(request);
  if (!await rateLimit(`trk:${ipKey(ip)}`, 120, 10 * 60_000)) return done();
  if (evt.name === 'landing_view' && evt.props.ref) evt.props.ref = refHost(body.props?.ref) || undefined;
  if (evt.props.ref === undefined) delete evt.props.ref;
  await logEvent(sb, evt, { anonId: dailyAnonId(ip, request.headers.get('user-agent')) });
  return done();
}
