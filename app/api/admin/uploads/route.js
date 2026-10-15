import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { isAdmin } from '../../../../lib/admin';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// Admin-only diagnostics: most recent upload rows (no creator ids exposed).
export async function GET(request) {
  if (!isAdmin(request)) return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: 'No storage.' }, { status: 503 });
  const { data, error } = await supabase.from('images').select('id, created_at, storage_path, aspect_ratio, is_public, creator_id')
    .eq('model', 'upload').order('created_at', { ascending: false }).limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tag = (s) => s.slice(0, 8);
  return NextResponse.json({ items: data.map((d) => ({ id: d.id, created_at: d.created_at, creator: tag(d.creator_id), file: d.storage_path.split('/').pop(), ratio: d.aspect_ratio, public: d.is_public })) });
}
