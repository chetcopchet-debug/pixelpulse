// Server-only: the id of a project if it exists and belongs to this creator, otherwise null.
// Never throws: a missing table (migration 011 not run), a bad id or someone else's project all give null.
import { getSupabase } from './supabase.js';
import { isUuid } from './identity.js';

export async function ownedProject(creatorId, id) {
  if (!creatorId || !isUuid(id)) return null;
  const sb = getSupabase(); if (!sb) return null;
  try {
    const { data, error } = await sb.from('projects').select('id').eq('id', id).eq('creator_id', creatorId).maybeSingle();
    return error || !data ? null : data.id;
  } catch { return null; }
}

// Puts a saved image or video into a project. Best effort: it never throws and never fails the save around it
// (the project may have been deleted a moment ago; the item then simply stays outside any project).
export async function fileInProject(imageId, creatorId, projectId) {
  if (!imageId || !creatorId || !projectId) return false;
  const sb = getSupabase(); if (!sb) return false;
  try {
    const { error } = await sb.from('images').update({ project_id: projectId }).eq('id', imageId).eq('creator_id', creatorId);
    if (error) console.warn('file in project', error.message);
    return !error;
  } catch { return false; }
}
