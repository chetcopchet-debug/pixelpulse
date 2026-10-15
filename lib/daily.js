// Server-only Daily Pulse helpers.
import { getSupabase } from './supabase';
import { themeFor, dayKey } from './dailyThemes';
import { isFormat } from './formats';

export const needSql = (e) => !!e && /column|relation|does not exist|schema cache|PGRST20[0-9]|42703|42P01|42883|function/i.test(`${e.message} ${e.code}`);

export async function getTheme(day = dayKey()) {
  const base = themeFor(day);
  const supabase = getSupabase();
  if (!supabase) return { ...base, day };
  const { data, error } = await supabase.from('daily_overrides').select('theme, format').eq('day', day).maybeSingle();
  if (!error && data && data.theme && isFormat(data.format)) return { text: data.theme, format: data.format, day, override: true };
  return { ...base, day };
}

const ENTRY_COLS = 'id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, model, format, daily_day';
export async function topEntries(day, limit = 24) {
  const supabase = getSupabase();
  if (!supabase) return { items: [], migrated: false };
  const { data, error } = await supabase.from('images').select(ENTRY_COLS).eq('is_public', true).eq('hidden', false)
    .eq('daily_day', day).order('likes', { ascending: false }).order('created_at', { ascending: true }).limit(limit);
  if (error) { if (!needSql(error)) console.error('daily entries:', error); return { items: [], migrated: !needSql(error) }; }
  return { items: data || [], migrated: true };
}

// Join today's pulse: returns { streak, isNew } or null before migration 004.
export async function joinDaily(uid, day = dayKey()) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('join_daily', { p_uid: uid, p_day: day });
  if (error) { if (!needSql(error)) console.error('join_daily:', error); return null; }
  const r = Array.isArray(data) ? data[0] : data;
  return r ? { streak: Number(r.streak) || 0, isNew: Boolean(r.is_new) } : null;
}

export async function getStreak(uid, today = dayKey()) {
  const supabase = getSupabase();
  if (!supabase || !uid) return 0;
  const { data, error } = await supabase.from('daily_streaks').select('last_day, streak').eq('uid', uid).maybeSingle();
  if (error || !data) return 0;
  const y = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return data.last_day === today || data.last_day === y ? data.streak : 0;
}
