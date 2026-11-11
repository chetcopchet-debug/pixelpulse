import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../../lib/identity';
import { accountGate } from '../../../../lib/needAccount';
import { rateLimit } from '../../../../lib/ratelimit';
import { notInstalled } from '../../../../lib/projects';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// POST { project: <id> | null, ids: [<image id>, ...] }
// Puts the caller's own images and videos into one of the caller's own projects, or takes them out (project: null).
export async function POST(request) {
  const gate = accountGate(request); if (gate) return gate;
  const sb = getSupabase();
  if (!sb) return fail('Projects are not available right now.', 503);
  const creator = getCreatorId(request);
  if (creator.isNew) return fail('Sign in to use projects.', 401);
  if (!await rateLimit(`projitem:${creator.id}`, 600, 60 * 60_000)) return fail('Too many changes. Try again later.', 429);
  const body = await request.json().catch(() => ({}));
  const ids = [...new Set((Array.isArray(body?.ids) ? body.ids : []).filter(isUuid))].slice(0, 100);
  if (!ids.length) return fail('Nothing to move.');
  const project = body?.project === null || body?.project === undefined ? null : body.project;
  if (project !== null) {
    if (!isUuid(project)) return fail('Unknown project.');
    const { data: own, error } = await sb.from('projects').select('id').eq('id', project).eq('creator_id', creator.id).maybeSingle();
    if (error) { if (notInstalled(error)) return fail('Projects are not available yet.', 503); console.error('project check', error.message); return fail('That did not work. Try again.', 500); }
    if (!own) return fail('Unknown project.', 404);
  }
  const { data, error } = await sb.from('images').update({ project_id: project }).eq('creator_id', creator.id).in('id', ids).select('id');
  if (error) { if (notInstalled(error)) return fail('Projects are not available yet.', 503); console.error('project move', error.message); return fail('That did not work. Try again.', 500); }
  return NextResponse.json({ ok: true, project, moved: (data || []).map((r) => r.id) });
}
