// A test tool, on a preview build only and only with the test door's secret (lib/testDoor.js); anywhere else
// it answers "not found". It only reads: nothing is saved, hidden or changed.
//   POST { images: [url, ...] }             -> what each of the two safety checkers says about each image
//   POST { videos: [url, ...], frames?: 5 } -> the frames of each video, each checked by the main checker
//   POST { runs: <version id> }             -> how long the latest runs of one model version took (read-only)
//   POST { list: 'tools' | 'videos', from?: 0, limit?: 50 } -> saved results to look back at: the results of
//        Upscale and Cut out (they were not checked before), or the saved videos
import { NextResponse } from 'next/server';
import { getSupabase } from '../../../../lib/supabase';
import { doorExists, doorOpens } from '../../../../lib/testDoor';
import { askChecker } from '../../../../lib/moderation';
import { sampleFrames } from '../../../../lib/transcode';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const notFound = () => new NextResponse(null, { status: 404 });
// Asked any other way it is "not found" too, so the address never looks like one that exists.
export { notFound as GET, notFound as HEAD, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as OPTIONS };

export async function POST(request) {
  if (!doorExists(process.env) || !doorOpens(process.env, request.headers.get('x-test-login'))) return notFound();
  const body = await request.json().catch(() => ({}));
  const sb = getSupabase();
  if (body.list) {
    if (!sb) return NextResponse.json({ error: 'no database' }, { status: 503 });
    const from = Math.max(0, Number(body.from) || 0), limit = Math.min(200, Number(body.limit) || 50);
    if (body.list === 'videos') {
      const { data, error, count } = await sb.from('images').select('id, public_url, model, created_at, featured_at, removed_at', { count: 'exact' }).like('storage_path', '%.mp4').order('created_at', { ascending: true }).range(from, from + limit - 1);
      return NextResponse.json({ total: count, items: data || [], error: error?.message });
    }
    const { data, error, count } = await sb.from('images').select('id, public_url, model, created_at, removed_at', { count: 'exact' }).in('model', ['sharpen', 'cutout']).order('created_at', { ascending: true }).range(from, from + limit - 1);
    // Older results of the two tools kept the model of the picture they were made from; the log knows them.
    const { data: logged } = await sb.from('generation_log').select('output_ref, mode').in('mode', ['sharpen', 'cutout']).eq('moderation', 'unchecked').order('id', { ascending: true }).range(from, from + limit - 1);
    const ids = (logged || []).map((l) => l.output_ref).filter((x) => /^[0-9a-f-]{36}$/.test(x || ''));
    const { data: byLog } = ids.length ? await sb.from('images').select('id, public_url, model, created_at, removed_at').in('id', ids) : { data: [] };
    return NextResponse.json({ total: count, items: data || [], logged: (logged || []).length, byLog: byLog || [], error: error?.message });
  }
  // POST { runs: <version id>, max?: 20 } -> the latest runs of one model version on the Replicate account: how long
  // each ran. For working out what a model that is billed by run time really costs.
  if (typeof body.runs === 'string' && /^[0-9a-f]{64}$/.test(body.runs)) {
    const headers = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}` };
    const found = []; let url = 'https://api.replicate.com/v1/predictions', pages = 0;
    const max = Math.min(30, Number(body.max) || 20);
    while (url && pages < 8 && found.length < max) {
      const r = await fetch(url, { headers, cache: 'no-store' }).catch(() => null);
      if (!r || !r.ok) break;
      const d = await r.json(); pages++;
      for (const p of d.results || []) if (p.version === body.runs && p.status === 'succeeded' && found.length < max) found.push(p);
      url = d.next || null;
    }
    const out = [];
    for (const p of found) {
      let t = p.metrics?.predict_time, model = p.model;
      if (typeof t !== 'number') { const r = await fetch(`https://api.replicate.com/v1/predictions/${p.id}`, { headers, cache: 'no-store' }).catch(() => null); const d = r && r.ok ? await r.json() : null; t = d?.metrics?.predict_time; model = d?.model || model; }
      out.push({ at: p.created_at, model, seconds: typeof t === 'number' ? Math.round(t * 1000) / 1000 : null });
    }
    return NextResponse.json({ pages, runs: out });
  }
  if (Array.isArray(body.images)) {
    const out = [];
    for (const url of body.images.slice(0, 8)) {
      const [main, backup] = await Promise.all([askChecker('main', url, 20_000), askChecker('backup', url, 20_000)]);
      out.push({ url, main: main || 'no answer', backup: backup || 'no answer' });
    }
    return NextResponse.json({ results: out });
  }
  if (Array.isArray(body.videos)) {
    const out = [];
    for (const url of body.videos.slice(0, 2)) {
      const res = await fetch(url, { cache: 'no-store' }).catch(() => null);
      if (!res || !res.ok) { out.push({ url, error: `download ${res?.status || 'failed'}` }); continue; }
      const frames = await sampleFrames(Buffer.from(await res.arrayBuffer()), Math.min(5, Number(body.frames) || 5), { budgetMs: 12_000 });
      const labels = await Promise.all(frames.map((b) => askChecker(body.checker === 'backup' ? 'backup' : 'main', `data:image/jpeg;base64,${b.toString('base64')}`, 20_000)));
      out.push({ url, frames: frames.length, labels: labels.map((l) => l || 'no answer') });
    }
    return NextResponse.json({ results: out });
  }
  return NextResponse.json({ error: 'nothing to do' }, { status: 400 });
}
