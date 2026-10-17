import { NextResponse } from 'next/server';
import { getSupabase, BUCKET, TMP_BUCKET } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { sweepJobs } from '../../../../lib/videoJobs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const TMP_MAX_AGE_MS = 60 * 60_000;
const COUNTER_KEEP_DAYS = 2;

// Delete raw uploads older than an hour under tmp/<owner>/ (they are converted within seconds).
async function cleanTmp(sb, bucket) {
  let removed = 0;
  const { data: dirs, error } = await sb.storage.from(bucket).list('tmp', { limit: 1000 });
  if (error || !dirs) return removed;
  const cutoff = Date.now() - TMP_MAX_AGE_MS;
  for (const d of dirs) {
    const { data: files } = await sb.storage.from(bucket).list(`tmp/${d.name}`, { limit: 1000 });
    const old = (files || []).filter((f) => f.name && Date.parse(f.created_at || f.updated_at || 0) < cutoff).map((f) => `tmp/${d.name}/${f.name}`);
    if (old.length) { const { error: e } = await sb.storage.from(bucket).remove(old); if (!e) removed += old.length; }
  }
  return removed;
}

// Daily (Vercel Hobby allows daily crons): finish/refund orphaned video jobs, clean temp uploads, prune rate-limit rows.
// Vercel sends "Authorization: Bearer $CRON_SECRET"; the admin cookie also works for a manual run.
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const authed = (secret && request.headers.get('authorization') === `Bearer ${secret}`) || isAdmin(request);
  if (!authed) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const sb = getSupabase(); if (!sb) return NextResponse.json({ error: 'Unavailable.' }, { status: 503 });
  const out = {};
  try { out.videoJobs = await sweepJobs(sb); } catch (e) { out.videoJobs = { error: String(e?.message || e) }; }
  try { out.tmpRemoved = (await cleanTmp(sb, TMP_BUCKET)) + (await cleanTmp(sb, BUCKET)); } catch (e) { out.tmpRemoved = { error: String(e?.message || e) }; }
  try {
    const cutoff = new Date(Date.now() - COUNTER_KEEP_DAYS * 86400_000).toISOString().slice(0, 10);
    const { error } = await sb.from('usage_counters').delete().lt('day', cutoff);
    out.countersPruned = !error;
  } catch { out.countersPruned = false; }
  return NextResponse.json({ ok: true, ...out });
}
