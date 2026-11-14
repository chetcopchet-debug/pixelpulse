import { NextResponse } from 'next/server';
import { getSupabase, isMissingModelColumn } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

// kind: upload | edit (sharpen/cutout/repaint -> png with remix_of, or guided) | created
function kindOf(r) {
  if (r.model === 'upload' && !r.remix_of) return 'upload';
  if (r.model === 'guided' || r.model === 'edit' || r.model === 'repaint' || (r.remix_of && /\.png$/i.test(r.storage_path || ''))) return 'edit';
  return 'created';
}

// GET /api/history?limit=24&cursor=<created_at ISO>&filter=all|created|uploads|edits&ids=a,b (favorites)&project=<id>
export async function GET(request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ enabled: false, items: [] });
  const creator = getCreatorId(request);
  if (creator.isNew) return NextResponse.json({ enabled: true, items: [], nextCursor: null });

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '24', 10) || 24, 1), 60);
  const cursor = searchParams.get('cursor');
  const filter = searchParams.get('filter') || 'all';
  const ids = (searchParams.get('ids') || '').split(',').filter(isUuid).slice(0, 200);
  const project = isUuid(searchParams.get('project')) ? searchParams.get('project') : null; // only this project's items

  const run = (cols, withModel) => {
    let q = supabase.from('images').select(cols).eq('creator_id', creator.id)
      .order('created_at', { ascending: false }).limit(limit);
    if (cursor && !Number.isNaN(Date.parse(cursor))) q = q.lt('created_at', cursor);
    if (project) q = q.eq('project_id', project);
    if (filter === 'favorites') q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
    if (withModel && filter === 'uploads') q = q.eq('model', 'upload').is('remix_of', null);
    // A picture that was uploaded to work from is not something the person made: it is not in the Library's list.
    // It is still theirs, under "Uploads" (filter=uploads), where it can be opened and edited.
    if (withModel && filter === 'all') q = q.or('model.is.null,model.neq.upload');
    if (withModel && filter === 'edits') q = q.or('model.eq.guided,and(remix_of.not.is.null,storage_path.like.*.png)');
    if (withModel && filter === 'created') q = q.or('remix_of.is.null,storage_path.not.like.*.png').or('model.is.null,model.not.in.(upload,guided)');
    return q;
  };
  const base = 'id, created_at, prompt, style, aspect_ratio, public_url, likes, remix_of, is_public, storage_path, featured_at';
  let { data, error } = await run(base + ', model, format, project_id', true);
  if (error && /project_id/i.test(error.message || '')) {
    // Migration 011 isn't installed: there are no projects, so a project has no items and the rest loads as before.
    if (project) return NextResponse.json({ enabled: true, items: [], nextCursor: null });
    ({ data, error } = await run(base + ', model, format', true));
  }
  if (error && /format/i.test(error.message || '')) ({ data, error } = await run(base + ', model', true));
  if (error && isMissingModelColumn(error)) ({ data, error } = await run(base, false));
  if (error) {
    console.error('History error:', error);
    return NextResponse.json({ error: 'Could not load history.' }, { status: 500 });
  }
  const items = data.map(({ storage_path, ...r }) => ({ ...r, kind: kindOf({ ...r, storage_path }) }));
  const nextCursor = data.length === limit ? data[data.length - 1].created_at : null;
  return NextResponse.json({ enabled: true, items, nextCursor });
}
