import { NextResponse } from 'next/server';
import { refusalLog } from '../../../lib/refusals';
import { getSupabase } from '../../../lib/supabase';
import { getCreatorId, isUuid } from '../../../lib/identity';
import { accountGate } from '../../../lib/needAccount';
import { rateLimit } from '../../../lib/ratelimit';
import { cleanName, notInstalled, MAX_PROJECTS } from '../../../lib/projects';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const off = () => NextResponse.json({ enabled: false, projects: [] });
const fail = (error, status = 400) => NextResponse.json({ error }, { status });

// GET: this account's projects, newest first, each with how many items it holds and a cover picture.
// { enabled: false } means projects aren't available (no storage, or migration 011 not run): the interface hides them.
export async function GET(request) {
  const sb = getSupabase();
  if (!sb) return off();
  const creator = getCreatorId(request);
  // A first-time visitor has no projects, but the question "are projects installed?" is still answered from the table.
  const { data, error } = await sb.from('projects').select('id, name, created_at').eq('creator_id', creator.id).order('created_at', { ascending: false }).limit(MAX_PROJECTS);
  if (error) { if (notInstalled(error)) return off(); console.error('projects list', error.message); return fail('Could not load your projects.', 500); }
  const count = {}, cover = {};
  if (data.length) {
    const { data: rows, error: e2 } = await sb.from('images').select('project_id, public_url').eq('creator_id', creator.id).not('project_id', 'is', null).order('created_at', { ascending: false }).limit(3000);
    if (e2) { if (notInstalled(e2)) return off(); console.error('projects count', e2.message); }
    for (const r of rows || []) {
      count[r.project_id] = (count[r.project_id] || 0) + 1;
      if (!cover[r.project_id] && !/\.mp4(\?|$)/i.test(r.public_url || '')) cover[r.project_id] = r.public_url;
    }
  }
  return NextResponse.json({ enabled: true, projects: data.map((p) => ({ id: p.id, name: p.name, count: count[p.id] || 0, cover: cover[p.id] || null })) });
}

// POST { action: 'create', name } | { action: 'rename', id, name } | { action: 'delete', id }
// Deleting a project keeps its images and videos; they just stop belonging to it.
async function handlePost(request) {
  const gate = accountGate(request); if (gate) return gate;
  const sb = getSupabase();
  if (!sb) return fail('Projects are not available right now.', 503);
  const creator = getCreatorId(request);
  if (creator.isNew) return fail('Sign in to use projects.', 401);
  if (!await rateLimit(`proj:${creator.id}`, 120, 60 * 60_000)) return fail('Too many changes. Try again later.', 429);
  const body = await request.json().catch(() => ({}));
  const gone = (error) => (notInstalled(error) ? fail('Projects are not available yet.', 503) : (console.error('projects', body?.action, error.message), fail('That did not work. Try again.', 500)));

  if (body?.action === 'create') {
    const name = cleanName(body.name);
    if (!name) return fail('Give the project a name.');
    const { count, error: ce } = await sb.from('projects').select('id', { count: 'exact', head: true }).eq('creator_id', creator.id);
    if (ce) return gone(ce);
    if ((count || 0) >= MAX_PROJECTS) return fail(`You have ${MAX_PROJECTS} projects. Delete one to add another.`);
    const { data, error } = await sb.from('projects').insert({ creator_id: creator.id, name }).select('id, name').single();
    if (error) return gone(error);
    return NextResponse.json({ ok: true, project: { id: data.id, name: data.name, count: 0, cover: null } });
  }
  if (!isUuid(body?.id)) return fail('Unknown project.');
  if (body.action === 'rename') {
    const name = cleanName(body.name);
    if (!name) return fail('Give the project a name.');
    const { data, error } = await sb.from('projects').update({ name }).eq('id', body.id).eq('creator_id', creator.id).select('id, name').maybeSingle();
    if (error) return gone(error);
    if (!data) return fail('Unknown project.', 404);
    return NextResponse.json({ ok: true, project: data });
  }
  if (body.action === 'delete') {
    const { data, error } = await sb.from('projects').delete().eq('id', body.id).eq('creator_id', creator.id).select('id').maybeSingle();
    if (error) return gone(error);
    if (!data) return fail('Unknown project.', 404);
    return NextResponse.json({ ok: true, id: data.id });
  }
  return fail('Unknown action.');
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('projects', handlePost);
