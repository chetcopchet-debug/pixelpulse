import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { isUuid } from '../../../../lib/identity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const needSql = (e) => /hidden|report_count|column|42703|PGRST204/i.test(`${e?.message} ${e?.code}`);

// GET: hidden public images (+ most reported). POST {id, hidden}: hide/unhide.
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  if (new URL(request.url).searchParams.get('usage')) {
    const day = new Date().toISOString().slice(0, 10);
    const { data: rows, error: e } = await supabase.from('usage_counters').select('key, amount').eq('day', day).limit(500);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    const spend = rows.filter((r) => r.key.startsWith('spend')).reduce((a, r) => a + Number(r.amount), 0);
    return NextResponse.json({ day, counters: rows.length, ipKeys: rows.filter((r) => r.key.startsWith('ip:')).length, spendUsd: spend });
  }
  const { data, error } = await supabase.from('images').select('id, prompt, public_url, hidden, report_count, created_at')
    .eq('is_public', true).or('hidden.eq.true,report_count.gt.0').order('created_at', { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: needSql(error) ? 'Run migration 003 first.' : error.message, needsMigration: needSql(error) }, { status: needSql(error) ? 409 : 500 });
  return NextResponse.json({ items: data });
}

export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  if (body.resetReports) {
    await supabase.from('image_reports').delete().eq('image_id', body.id);
    const { error: e } = await supabase.from('images').update({ report_count: 0 }).eq('id', body.id);
    if (e) return NextResponse.json({ error: e.message }, { status: 500 });
    if (body.hidden === undefined) return NextResponse.json({ success: true, id: body.id, report_count: 0 });
  }
  const hidden = body.hidden !== false;
  let { data, error } = await supabase.from('images').update({ hidden }).eq('id', body.id).select('id, hidden').maybeSingle();
  if (error && needSql(error)) {
    // Before migration 003: hiding falls back to un-publishing.
    if (!hidden) return NextResponse.json({ error: 'Run migration 003 to unhide.' }, { status: 409 });
    ({ data, error } = await supabase.from('images').update({ is_public: false }).eq('id', body.id).select('id').maybeSingle());
    if (!error) return NextResponse.json({ success: true, id: body.id, hidden: true, fallback: 'unpublished' });
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  return NextResponse.json({ success: true, ...data });
}
