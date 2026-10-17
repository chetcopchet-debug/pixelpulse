import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { getTheme, topEntries, getStreak, needSql } from '../../../lib/daily';
import { dayKey, shiftDay, nextPulseAt } from '../../../lib/dailyThemes';
import { isFormat } from '../../../lib/formats';
import { withErrorLog } from '../../../lib/monitor';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// GET: today's theme, leaderboard, yesterday's winner (+ chain count), visitor streak.
async function GETHandler(request) {
  const today = dayKey();
  const theme = await getTheme(today);
  const base = { day: today, theme, nextAt: nextPulseAt() };
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ ...base, migrated: false, entries: [], winner: null, streak: 0 });
  const [{ items, migrated }, y] = await Promise.all([topEntries(today, 24), topEntries(shiftDay(today, -1), 1)]);
  let winner = null;
  if (y.items[0]) {
    const w = y.items[0];
    const { count } = await supabase.from('images').select('id', { count: 'exact', head: true }).eq('remix_of', w.id).eq('is_public', true);
    winner = { ...w, chain: count || 0, theme: (await getTheme(w.daily_day)).text };
  }
  const creator = getCreatorId(request);
  let liked = new Set();
  if (!creator.isNew && items.length) {
    const { data: likes } = await supabase.from('image_likes').select('image_id').eq('creator_id', creator.id).in('image_id', items.map((d) => d.id));
    liked = new Set((likes || []).map((l) => l.image_id));
  }
  const streak = creator.isNew ? 0 : await getStreak(creator.id, today);
  return NextResponse.json({ ...base, migrated, entries: items.map((d) => ({ ...d, is_public: true, liked: liked.has(d.id) })), winner, streak });
}

// POST (admin): override today's theme { theme, format } or clear with { clear: true }.
async function POSTHandler(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  const body = await request.json().catch(() => ({}));
  const day = dayKey();
  if (body.clear) {
    const { error } = await supabase.from('daily_overrides').delete().eq('day', day);
    if (error) return NextResponse.json({ error: needSql(error) ? 'Run migration 004 first.' : error.message }, { status: needSql(error) ? 409 : 500 });
    return NextResponse.json({ success: true, theme: await getTheme(day) });
  }
  const theme = String(body.theme || '').trim().slice(0, 120);
  if (theme.length < 2 || !isFormat(body.format)) return NextResponse.json({ error: 'Need theme and a valid format.' }, { status: 400 });
  const { error } = await supabase.from('daily_overrides').upsert({ day, theme, format: body.format });
  if (error) return NextResponse.json({ error: needSql(error) ? 'Run migration 004 first.' : error.message }, { status: needSql(error) ? 409 : 500 });
  return NextResponse.json({ success: true, theme: await getTheme(day) });
}

export const GET = withErrorLog('/api/daily', GETHandler);
export const POST = withErrorLog('/api/daily', POSTHandler);
