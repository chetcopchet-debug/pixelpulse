import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';
import { getClientIp, readCreditsCookie, setCreditsCookie, grantIpBonus, ipRemaining, COOKIE_NAME, DAILY_CREDITS, DAILY_BONUS } from '../../../lib/credits';
import { joinDaily } from '../../../lib/daily';
import { dayKey } from '../../../lib/dailyThemes';
import { bump, DAILY_SPEND_CAP_USD } from '../../../lib/usage';
import { rateLimit } from '../../../lib/ratelimit';

import { isAdmin } from '../../../lib/admin';
import { moderateForPublish } from '../../../lib/moderation';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function POST(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'Community feed is not available yet.' }, { status: 503 });

  const creator = getCreatorId(request);
  if (creator.isNew) return NextResponse.json({ error: 'You can only publish your own images.' }, { status: 403 });

  const ip = getClientIp(request);
  if (!isAdmin(request) && (!await rateLimit(`pub:ip:${ip}`, 10, 60_000) || !await rateLimit(`pub:uid:${creator.id}`, 30, 60 * 60_000))) {
    return NextResponse.json({ error: 'Too many requests. Please wait a minute.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid image id.' }, { status: 400 });
  const makePublic = body.public !== false;
  let entryDay = null;
  if (makePublic) {
    const { data: dRow, error: dErr } = await supabase.from('images').select('daily_day').eq('id', body.id).eq('creator_id', creator.id).maybeSingle();
    if (!dErr && dRow?.daily_day === dayKey()) entryDay = dRow.daily_day;
    const { data: row } = await supabase.from('images').select('model, prompt, public_url, is_public').eq('id', body.id).eq('creator_id', creator.id).maybeSingle();
    if (!row) return NextResponse.json({ error: 'Image not found or not yours.' }, { status: 404 });
    if (row.model === 'upload') return NextResponse.json({ error: 'Uploaded photos (and edits of them) stay private and cannot be published to the feed.' }, { status: 403 });
    if (!row.is_public) {
      const mod = await moderateForPublish({ prompt: row.prompt, imageUrl: row.public_url });
      if (!mod.ok) return NextResponse.json({ error: mod.reason, moderation: true }, { status: mod.retry ? 503 : 422 });
    }
  }

  const { data, error } = await supabase
    .from('images')
    .update({ is_public: makePublic })
    .eq('id', body.id)
    .eq('creator_id', creator.id)
    .select('id, is_public')
    .maybeSingle();

  if (error) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: 'Could not publish. Please try again.' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Image not found or not yours.' }, { status: 404 });
  // Daily Pulse entry: streak + once-per-day bonus (skipped when today's spend is near the cap)
  let daily = null;
  if (entryDay && data.is_public) {
    const j = await joinDaily(creator.id, entryDay);
    if (j) {
      daily = { streak: j.streak, bonus: 0 };
      if (j.isNew && !isAdmin(request)) {
        const spent = await bump('spend', 0, 1e9).catch(() => null);
        if (typeof spent === 'number' && spent < DAILY_SPEND_CAP_USD * 0.9 && await grantIpBonus(ip)) daily.bonus = DAILY_BONUS;
      }
    }
  }
  const res = NextResponse.json({ success: true, id: data.id, isPublic: data.is_public, ...(daily ? { daily } : {}) });
  if (daily?.bonus) {
    const state = readCreditsCookie(request.cookies.get(COOKIE_NAME)?.value);
    state.remaining = Math.min(state.remaining + DAILY_BONUS, DAILY_CREDITS + DAILY_BONUS);
    setCreditsCookie(res, state);
    daily.credits = Math.min(state.remaining, ipRemaining(ip));
    return NextResponse.json({ success: true, id: data.id, isPublic: data.is_public, daily }, { headers: res.headers });
  }
  return res;
}
