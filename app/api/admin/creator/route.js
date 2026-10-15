import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';
import { thumbUrl } from '../../../../lib/thumbs';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Admin diagnostics: one creator's rows (by uid prefix, min 8 chars) with HEAD status of full image and thumbnail.
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const prefix = (new URL(request.url).searchParams.get('prefix') || '').toLowerCase();
  const q = (new URL(request.url).searchParams.get('q') || '').slice(0, 60).replace(/[%_,()]/g, ' ').trim();
  if (!q && !/^[0-9a-f-]{8,36}$/.test(prefix)) return NextResponse.json({ error: 'prefix (8+ hex chars) or q required' }, { status: 400 });
  const supabase = getSupabase();
  let sel = supabase.from('images').select('id, created_at, prompt, public_url, storage_path, model, creator_id');
  sel = q ? sel.ilike('prompt', `%${q}%`) : sel.gte('creator_id', prefix).lt('creator_id', prefix + 'g');
  const { data, error } = await sel.order('created_at', { ascending: false }).limit(60);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const head = async (u) => { try { return (await fetch(u, { method: 'HEAD', cache: 'no-store' })).status; } catch { return 0; } };
  const items = await Promise.all(data.map(async (r) => ({
    id: r.id, created_at: r.created_at, prompt: (r.prompt || '').slice(0, 50), path: r.storage_path, model: r.model,
    full: await head(r.public_url), thumb: thumbUrl(r.public_url) !== r.public_url ? await head(thumbUrl(r.public_url)) : 'n/a',
    urlMatchesPath: (r.public_url || '').endsWith(r.storage_path || '#'),
  })));
  return NextResponse.json({ creators: [...new Set(data.map((d) => d.creator_id.slice(0, 8)))], count: items.length, items });
}
