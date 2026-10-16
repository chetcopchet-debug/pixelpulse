import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid, creatorTag } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';
import { normalizeReport, applyTakedown, REPORT_REASONS } from '../../../lib/trustSafety';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// POST { id, reason: nonconsensual|sexual|minor|violence|other, details? } — works logged out; rate-limited per IP.
export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!await rateLimit(`rep:${ip}`, 15, 60 * 60_000)) return NextResponse.json({ error: 'Too many reports. Try later.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image.' }, { status: 400 });
  const { code, details } = normalizeReport(body);
  if (!code) return NextResponse.json({ error: 'Pick a reason.', reasons: Object.keys(REPORT_REASONS) }, { status: 400 });
  // Reporter key: signed visitor id + IP, hashed (one report per visitor per image)
  const reporter = creatorTag(`${creator.id}|${ip}`, 'report');
  const reasonText = `${code}${details ? `: ${details}` : ''}`.slice(0, 200);
  const done = (extra) => { const res = NextResponse.json({ success: true, message: 'Thanks — we\'ll review it.', ...extra }); setCreatorCookie(res, creator); return res; };
  const { data: count, error } = await supabase.rpc('report_image', { p_image: body.id, p_reporter: reporter, p_reason: reasonText, p_threshold: 3 });
  if (error) {
    console.error('Report error (migration 003 installed?):', error.message);
    console.warn('REPORT (unstored):', body.id, code);
    return done({ stored: false });
  }
  if (count === null) return done({ stored: true, duplicate: true });
  await supabase.from('image_reports').update({ reason_code: code, details: details || null }).eq('image_id', body.id).eq('reporter', reporter);
  let takedown = {};
  try { takedown = await applyTakedown(supabase, { imageId: body.id, code, distinctReporters: count }); }
  catch (e) { console.error('takedown', e?.message || e); }
  return done({ stored: true, hidden: Boolean(takedown.hidden) });
}
