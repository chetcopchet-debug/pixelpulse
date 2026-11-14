// TEST ADDRESS ONLY. This is in the `preview` branch and is not part of the site (it is never merged to main).
// On a preview build only and only with the test door's secret; anywhere else it answers "not found".
// Enlarges a video to 1080p with Topaz Video Upscale, for videos from a model that stops at 720p.
//   POST { url }  -> starts the run, answers { p: <run id> }
//   POST { p }    -> how the run is doing: { status, output }
// Replicate bills it by output size: about $0.19 for 10 seconds at 1080p (model page, 14 Nov 2026). No credits are
// taken; the cost is counted in the preview's own spending total.
import { NextResponse } from 'next/server';
import { doorExists, doorOpens } from '../../../../lib/testDoor';
import { reserveSpend } from '../../../../lib/usage';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const notFound = () => new NextResponse(null, { status: 404 });
export { notFound as GET, notFound as HEAD, notFound as PUT, notFound as PATCH, notFound as DELETE, notFound as OPTIONS };
const OURS = /^https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/images\/i\/[A-Za-z0-9_-]+\.mp4$/;

export async function POST(request) {
  if (!doorExists(process.env) || !doorOpens(process.env, request.headers.get('x-test-login'))) return notFound();
  const body = await request.json().catch(() => ({}));
  const headers = { Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`, 'Content-Type': 'application/json' };
  if (typeof body.p === 'string' && /^[a-z0-9]{10,40}$/.test(body.p)) {
    const r = await fetch(`https://api.replicate.com/v1/predictions/${body.p}`, { headers, cache: 'no-store' });
    const p = await r.json().catch(() => ({}));
    return NextResponse.json({ status: p.status || 'unknown', output: p.output || null, error: p.error || null });
  }
  if (typeof body.url !== 'string' || !OURS.test(body.url)) return NextResponse.json({ error: 'Give the address of one of our saved videos.' }, { status: 400 });
  await reserveSpend(0.19, { admin: true });
  const r = await fetch('https://api.replicate.com/v1/models/topazlabs/video-upscale/predictions', { method: 'POST', headers,
    body: JSON.stringify({ input: { video: body.url, target_resolution: body.target === '4k' ? '4k' : '1080p', target_fps: Number(body.fps) || 24 } }) });
  const p = await r.json().catch(() => ({}));
  if (!r.ok || !p.id) return NextResponse.json({ error: String(p.detail || p.error || r.status).slice(0, 300) }, { status: 502 });
  return NextResponse.json({ p: p.id });
}
