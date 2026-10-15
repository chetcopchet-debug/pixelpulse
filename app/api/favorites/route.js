import { NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabase';
import { readAccount } from '../../../lib/account';
import { isUuid } from '../../../lib/identity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Cloud favorites for signed-in accounts. { cloud: false } tells the client to keep using localStorage
// (guest, or migration 007 not installed yet).
const missing = (e) => /favorites|relation|schema cache|42P01|PGRST205/i.test(`${e?.message} ${e?.code}`);
const MAX = 500;

export async function GET(request) {
  const acct = readAccount(request); const sb = getSupabase();
  if (!acct || !sb) return NextResponse.json({ cloud: false });
  const { data, error } = await sb.from('favorites').select('image_id').eq('uid', acct.uid).order('created_at', { ascending: false }).limit(MAX);
  if (error) { if (!missing(error)) console.error('favorites get:', error); return NextResponse.json({ cloud: false }); }
  return NextResponse.json({ cloud: true, ids: data.map((r) => r.image_id) });
}

// POST { add: [ids], remove: [ids] } -> { cloud, ids }
export async function POST(request) {
  const acct = readAccount(request); const sb = getSupabase();
  if (!acct || !sb) return NextResponse.json({ cloud: false });
  const body = await request.json().catch(() => ({}));
  const pick = (v) => [...new Set((Array.isArray(v) ? v : []).filter(isUuid))].slice(0, MAX);
  const add = pick(body.add), remove = pick(body.remove);
  if (add.length) {
    // Only images this account can see (its own or public); unknown ids are dropped.
    const { data: ok } = await sb.from('images').select('id, is_public, creator_id').in('id', add);
    const rows = (ok || []).filter((r) => r.is_public || r.creator_id === acct.uid).map((r) => ({ uid: acct.uid, image_id: r.id }));
    if (rows.length) {
      const { error } = await sb.from('favorites').upsert(rows, { onConflict: 'uid,image_id', ignoreDuplicates: true });
      if (error) { if (!missing(error)) console.error('favorites add:', error); return NextResponse.json({ cloud: false }); }
    }
  }
  if (remove.length) {
    const { error } = await sb.from('favorites').delete().eq('uid', acct.uid).in('image_id', remove);
    if (error) { if (!missing(error)) console.error('favorites remove:', error); return NextResponse.json({ cloud: false }); }
  }
  return GET(request);
}
