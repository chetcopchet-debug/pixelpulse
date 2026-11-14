// A test tool, on a preview build only and only with the test door's secret (lib/testDoor.js); anywhere else
// it answers "not found". It only reads: nothing is saved, hidden or changed.
//   POST { images: [url, ...] }             -> what each of the two safety checkers says about each image
//   POST { videos: [url, ...], frames?: 5 } -> the frames of each video, each checked by the main checker
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
