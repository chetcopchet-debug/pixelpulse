import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { isUuid } from '../../../../lib/identity';
import { thumbPath } from '../../../../lib/thumbs';
import { slaDue, addStrike, selectImages, quarantineFiles, unquarantineFiles } from '../../../../lib/trustSafety';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
const COLS = 'id, prompt, public_url, storage_path, creator_id, is_public, hidden, report_count, removed_at, removal_reason, first_reported_at, created_at, quarantine_path';
const needSql = (e) => /removed_at|first_reported_at|reason_code|column|42703|PGRST204/i.test(`${e?.message} ${e?.code}`);

// GET: report queue (reported / hidden / removed), oldest SLA first.
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Not available.' }, { status: 503 });
  const { data: items, error } = await selectImages(sb, COLS, (q) => q.or('report_count.gt.0,hidden.eq.true,removed_at.not.is.null')
    .order('first_reported_at', { ascending: true, nullsFirst: false }).limit(100));
  if (error) return NextResponse.json({ error: needSql(error) ? 'Run migration 009 first.' : error.message }, { status: needSql(error) ? 409 : 500 });
  const ids = items.map((i) => i.id);
  const { data: reps } = ids.length ? await sb.from('image_reports').select('image_id, reason, reason_code, details, created_at').in('image_id', ids).order('created_at') : { data: [] };
  const creators = [...new Set(items.map((i) => i.creator_id).filter(Boolean))];
  const { data: bans } = creators.length ? await sb.from('banned_creators').select('creator_id').in('creator_id', creators) : { data: [] };
  const { data: strikes } = creators.length ? await sb.from('moderation_strikes').select('creator_id').in('creator_id', creators) : { data: [] };
  const banned = new Set((bans || []).map((b) => b.creator_id));
  const now = Date.now();
  return NextResponse.json({ items: items.map((i) => {
    const due = slaDue(i.first_reported_at);
    return { ...i, creator_id: undefined, creator: i.creator_id ? i.creator_id.slice(0, 8) : null,
      reports: (reps || []).filter((r) => r.image_id === i.id).map(({ image_id, ...r }) => r),
      slaDue: due, overdue: Boolean(due && !i.removed_at && Date.parse(due) < now),
      strikes: (strikes || []).filter((s) => s.creator_id === i.creator_id).length, banned: banned.has(i.creator_id) };
  }) });
}

// POST { id, action: restore | remove | delete | ban | unban }
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Not available.' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (!isUuid(body?.id)) return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
  const { data: row, error } = await selectImages(sb, 'id, creator_id, storage_path, quarantine_path', (q) => q.eq('id', body.id).maybeSingle());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const now = new Date().toISOString();
  switch (body.action) {
    case 'restore': {
      if (!await unquarantineFiles(sb, row)) return NextResponse.json({ error: 'Could not move the file back from quarantine.' }, { status: 500 });
      await sb.from('image_reports').delete().eq('image_id', row.id);
      await sb.from('moderation_strikes').delete().eq('image_id', row.id);
      const { error: e } = await sb.from('images').update({ hidden: false, report_count: 0, removed_at: null, removal_reason: null, first_reported_at: null }).eq('id', row.id);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      return NextResponse.json({ success: true, restored: true, note: 'An existing ban is not lifted automatically; use unban.' });
    }
    case 'remove': {
      const { error: e } = await sb.from('images').update({ hidden: true, removed_at: now, removal_reason: 'admin:remove' }).eq('id', row.id);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      const quarantined = await quarantineFiles(sb, row); // public copy deleted only after the private evidence copy exists
      return NextResponse.json({ success: true, quarantined, ...(await addStrike(sb, { imageId: row.id, creatorId: row.creator_id, source: 'admin:remove' })) });
    }
    case 'delete': {
      const strike = await addStrike(sb, { imageId: row.id, creatorId: row.creator_id, source: 'admin:delete' });
      const paths = [row.storage_path, thumbPath(row.storage_path)].filter(Boolean);
      if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch((e) => console.error('Storage remove:', e));
      const { error: e } = await sb.from('images').delete().eq('id', row.id);
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: true, ...strike });
    }
    case 'ban':
    case 'unban': {
      if (!row.creator_id) return NextResponse.json({ error: 'No creator.' }, { status: 400 });
      const q = body.action === 'ban'
        ? sb.from('banned_creators').upsert({ creator_id: row.creator_id, reason: 'admin' }, { onConflict: 'creator_id' })
        : sb.from('banned_creators').delete().eq('creator_id', row.creator_id);
      const { error: e } = await q;
      if (e) return NextResponse.json({ error: e.message }, { status: 500 });
      return NextResponse.json({ success: true, banned: body.action === 'ban' });
    }
    default: return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
  }
}
