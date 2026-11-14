// The light copy of a gallery video: what plays, without sound, inside its tile on Explore.
// images/i/<name>.mp4 -> images/p/<name>.mp4: at most 480 px on the short side, at most 6 seconds, no sound,
// a few hundred KB. The full video is what opens when the tile is tapped.
// A copy is made when a video is put in the gallery, and Explore makes any that are missing, one at a time,
// after it has answered (so nobody waits for it).
import { getSupabase, BUCKET } from './supabase';
import { CACHE_SECONDS, previewPath } from './thumbs';
import { lightVideo } from './transcode';

// Does the copy exist? One small request to the public address.
export async function hasPreview(publicUrl) {
  const m = /^(.*\/images\/)i\/([A-Za-z0-9_-]+)\.mp4/i.exec(publicUrl || '');
  if (!m) return false;
  try { const r = await fetch(`${m[1]}p/${m[2]}.mp4`, { method: 'HEAD', cache: 'no-store' }); return r.ok; } catch { return false; }
}

// Makes and saves the copy. Returns true when it is there afterwards.
export async function makePreview(row) {
  const sb = getSupabase();
  const path = previewPath(row?.storage_path);
  if (!sb || !path || !row.public_url) return false;
  try {
    const res = await fetch(row.public_url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`download ${res.status}`);
    const small = await lightVideo(Buffer.from(await res.arrayBuffer()));
    if (!small) throw new Error('could not be converted');
    const { error } = await sb.storage.from(BUCKET).upload(path, small, { contentType: 'video/mp4', upsert: true, cacheControl: CACHE_SECONDS });
    if (error) throw new Error(error.message);
    console.log('video preview made', row.id, `${Math.round(small.length / 1024)} KB`);
    return true;
  } catch (e) { console.error('video preview failed', row?.id, e?.message || e); return false; }
}
