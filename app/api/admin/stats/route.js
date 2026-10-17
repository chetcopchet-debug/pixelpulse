import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { buildStats } from '../../../../lib/statsAggregate';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const needSql = (e) => /analytics_daily|generation_daily|error_log|function|42883|42P01|PGRST202|PGRST205/i.test(`${e?.message} ${e?.code}`);

// GET ?days=7|14|30 — aggregated analytics + errors for /admin/stats (admin cookie required).
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Not available.' }, { status: 503 });
  const days = [7, 14, 30].includes(Number(new URL(request.url).searchParams.get('days'))) ? Number(new URL(request.url).searchParams.get('days')) : 14;
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86400_000).toISOString();
  const [ev, gen, errs] = await Promise.all([
    sb.rpc('analytics_daily', { p_since: since }),
    sb.rpc('generation_daily', { p_since: since }),
    sb.from('error_log').select('fingerprint, source, route, message, stack, release, count, first_seen, last_seen').gte('last_seen', since).order('last_seen', { ascending: false }).limit(50),
  ]);
  const err = ev.error || gen.error || errs.error;
  if (err) return NextResponse.json({ error: needSql(err) ? 'Run migration 011 first (supabase/migrations/011_analytics_monitoring.sql).' : 'Stats are unavailable right now.' }, { status: needSql(err) ? 409 : 500 });
  return NextResponse.json({ days, today, ...buildStats({ events: ev.data || [], generations: gen.data || [], errors: errs.data || [], days, today }) });
}
