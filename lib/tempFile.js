// A file a model has to read for one run (for example the cut-out part of an image and its mask). It gets a
// random name nobody can guess, lives for the length of the run and is removed when the run is over.
import { getSupabase, BUCKET } from './supabase';
import { randomName } from './identity';

export async function tempFile(bytes, contentType) {
  const supabase = getSupabase();
  if (!supabase) return null;
  const path = `tmp/${randomName()}${randomName()}.${contentType.includes('png') ? 'png' : 'jpg'}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType, cacheControl: '60' });
  if (error) { console.error('Temp file upload failed:', error.message || error); return null; }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, remove: () => supabase.storage.from(BUCKET).remove([path]).then(() => {}, () => {}) };
}

export async function fetchBytes(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) return Buffer.from(await r.arrayBuffer()); } catch {}
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}
