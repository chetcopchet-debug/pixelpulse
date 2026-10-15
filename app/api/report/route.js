import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, setCreatorCookie, isUuid, creatorTag } from '../../../lib/identity';
import { getClientIp } from '../../../lib/credits';
import { rateLimit } from '../../../lib/ratelimit';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Not available.' }, { status: 503 });
  const creator = getCreatorId(request);
  const ip = getClientIp(request);
  if (!rateLimit(`rep:${ip}`, 15, 60 * 60_000)) return NextResponse.json({ error: 'Too many reports. Try later.' }, { status: 429 });
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image.' }, { status: 400 });
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 200) : 'unspecified';
  // Reporter key: signed visitor id + IP, hashed (one report per visitor per image)
  const reporter = creatorTag(`${creator.id}|${ip}`, 'report');
  const { data, error } = await supabase.rpc('report_image', { p_image: body.id, p_reporter: reporter, p_reason: reason, p_threshold: 3 });
  if (error) {
    console.error('Report error (migration 003 installed?):', error.message);
    console.warn('REPORT (unstored):', body.id, reason);
    const res = NextResponse.json({ success: true, stored: false, message: 'Thanks — we got your report.' });
    setCreatorCookie(res, creator); return res;
  }
  const res = NextResponse.json({ success: true, stored: true, duplicate: data === null, message: 'Thanks — we\'ll review it.' });
  setCreatorCookie(res, creator);
  return res;
}
