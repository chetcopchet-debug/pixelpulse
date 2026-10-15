import { NextResponse } from 'next/server';
import { getSupabase, BUCKET } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { randomName } from '../../../../lib/identity';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// One-time (idempotent) admin migration: move every object whose path starts with a creator id
// ("<uuid>/file.ext") to a random path "i/<random>.ext" and update the row. Call repeatedly until remaining = 0.
export async function POST(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'No storage.' }, { status: 503 });
  const started = Date.now();
  const { data: rows, error } = await supabase.from('images').select('id, storage_path')
    .not('storage_path', 'like', 'i/%').order('created_at', { ascending: true }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let moved = 0; const failed = [];
  for (const r of rows) {
    if (Date.now() - started > 50_000) break;
    const ext = (r.storage_path.match(/\.([a-z0-9]{2,5})$/i)?.[1] || 'webp').toLowerCase();
    const to = `i/${randomName()}.${ext}`;
    const { error: mvErr } = await supabase.storage.from(BUCKET).move(r.storage_path, to);
    if (mvErr) { failed.push({ id: r.id, error: mvErr.message }); continue; }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(to);
    const { error: upErr } = await supabase.from('images').update({ storage_path: to, public_url: pub.publicUrl }).eq('id', r.id);
    if (upErr) {
      await supabase.storage.from(BUCKET).move(to, r.storage_path).catch(() => {});
      failed.push({ id: r.id, error: upErr.message }); continue;
    }
    moved++;
  }
  const { count } = await supabase.from('images').select('id', { count: 'exact', head: true }).not('storage_path', 'like', 'i/%');
  // Clean leftover temp uploads
  return NextResponse.json({ moved, failed, remaining: count ?? null });
}
