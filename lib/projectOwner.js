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
