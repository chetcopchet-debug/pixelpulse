// Every saved video is brought to one format that phones and browsers play: H.264 video with 4:2:0 colour
// (8-bit), AAC sound, and the index at the start of the file ("faststart") so it can begin before it has
// fully downloaded. Models hand back whatever their own pipeline writes; some of it does not play on phones.
//
// The work is done by ffmpeg. On Vercel the program comes from the `ffmpeg-static` package (next.config.mjs
// makes sure the file is shipped with the functions that save videos). FFMPEG_PATH overrides it (tests, other hosts).
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { probeMp4, looksLikeVideo } from './videoJobCore.js';

let binary; // undefined = not looked up yet, null = not available
export async function ffmpegBinary() {
  if (binary !== undefined) return binary;
  try {
    const p = process.env.FFMPEG_PATH || (await import('ffmpeg-static')).default;
    if (!p) throw new Error('no path');
    await fs.access(p);
    binary = p;
  } catch (e) { console.error('ffmpeg is not available:', e?.message || e); binary = null; }
  return binary;
}

function run(bin, args, ms) {
  return new Promise((resolve) => {
    let err = '';
    const child = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const timer = setTimeout(() => { err += '\ntimed out'; child.kill('SIGKILL'); }, ms);
    child.stderr.on('data', (d) => { if (err.length < 8000) err += d; });
    child.on('error', (e) => { clearTimeout(timer); resolve({ code: -1, err: String(e?.message || e) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ code, err }); });
  });
}

// "ffmpeg 6.0 ..." or null. Shown on /admin so a missing converter is visible.
export async function converterVersion() {
  const bin = await ffmpegBinary(); if (!bin) return null;
  const out = await new Promise((resolve) => {
    let s = ''; const c = spawn(bin, ['-version'], { stdio: ['ignore', 'pipe', 'ignore'] });
    c.stdout.on('data', (d) => { if (s.length < 400) s += d; }); c.on('error', () => resolve('')); c.on('close', () => resolve(s));
  });
  return (out.split('\n')[0] || '').replace(/ Copyright.*$/, '').trim() || null;
}

// Even sizes are required for 4:2:0; a model can return an odd width or height.
const ENCODE = ['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:a', 'aac', '-b:a', '128k'];
const REPACK = ['-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy'];

// Returns { bytes, how, ok, before, after, why? }.
//   how 'repacked' : the picture was already H.264 4:2:0, only the index was moved to the start (no quality loss)
//   how 'encoded'  : the picture was re-made as H.264 4:2:0
//   how 'kept'     : nothing could be done; `ok` says whether the original is known to be unplayable (false) or not
// `always: true` re-encodes even when the picture already looks right.
export async function toWebVideo(bytes, { budgetMs = 40_000, always = false } = {}) {
  const before = probeMp4(bytes);
  const keep = (why) => ({ bytes, how: 'kept', ok: before.web !== false, before, after: before, why });
  if (before.web === true && before.indexFirst && (!before.audio || before.audio === 'mp4a') && !always) return { bytes, how: 'kept', ok: true, before, after: before };
  const bin = await ffmpegBinary();
  if (!bin) return keep('the converter is not available on this server');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppv-'));
  const src = path.join(dir, 'in.mp4'), dst = path.join(dir, 'out.mp4');
  const started = Date.now();
  const attempt = async (args) => {
    await fs.rm(dst, { force: true });
    const left = budgetMs - (Date.now() - started);
    if (left < 3000) throw new Error('no time left');
    const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, ...args, '-movflags', '+faststart', '-f', 'mp4', dst], left);
    if (r.code !== 0) throw new Error((r.err || `ffmpeg exit ${r.code}`).trim().slice(-240));
    const out = await fs.readFile(dst);
    const after = probeMp4(out);
    if (!looksLikeVideo(out) || after.web !== true || !after.indexFirst) throw new Error(`unexpected result: ${after.summary}`);
    return { out, after };
  };
  try {
    await fs.writeFile(src, bytes);
    const canRepack = !always && before.web === true && (!before.audio || before.audio === 'mp4a');
    let res = null, how = 'encoded';
    if (canRepack) { try { res = await attempt(REPACK); how = 'repacked'; } catch (e) { console.error('video repack failed, encoding instead:', e?.message || e); } }
    if (!res) res = await attempt(ENCODE);
    return { bytes: res.out, how, ok: true, before, after: res.after };
  } catch (e) {
    console.error('video conversion failed:', e?.message || e);
    return keep(String(e?.message || e).slice(0, 200));
  } finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// The first picture of a video, as JPEG bytes, or null. It becomes the video's still in lists and on the result
// screen, so nobody has to look at an empty frame with a play mark until they press play.
export async function firstFrame(bytes, { budgetMs = 10_000 } = {}) {
  const bin = await ffmpegBinary();
  if (!bin) return null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppf-'));
  const src = path.join(dir, 'in.mp4'), dst = path.join(dir, 'frame.jpg');
  try {
    await fs.writeFile(src, bytes);
    const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-frames:v', '1', '-q:v', '3', dst], budgetMs);
    if (r.code !== 0) throw new Error((r.err || `ffmpeg exit ${r.code}`).trim().slice(-200));
    const out = await fs.readFile(dst);
    return out.length > 500 ? out : null;
  } catch (e) { console.error('first frame failed:', e?.message || e); return null; }
  finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// Still pictures from along a video, for the safety check of a finished video: `count` frames spread from its
// start to its end, each a small JPEG. Returns [] when they could not be made (the caller then treats the video
// as unchecked, which blocks it).
// All the frames are taken in one pass over the video. Taking them one by one meant decoding the video again from
// its start for every frame when the file has a single key frame, which some models write (Veo at 1080p: 25 MB,
// one key frame): five frames cost two and a half passes and ran out of time, so the video was never saved.
// The decoder also skips its smoothing step: these pictures are only looked at by the safety checker, at 512 px.
// From just after the start to just before the end (never past the last frame of a short video).
export function frameTimes(secs, count) {
  const first = secs * 0.03, last = Math.max(first, Math.min(secs * 0.97, secs - 0.15));
  return Array.from({ length: count }, (_, i) => first + ((last - first) * i) / Math.max(1, count - 1));
}
export async function sampleFrames(bytes, count = 5, { budgetMs = 20_000 } = {}) {
  const bin = await ffmpegBinary();
  if (!bin) return [];
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pps-'));
  const src = path.join(dir, 'in.mp4');
  const end = Date.now() + budgetMs;
  const left = () => Math.max(2000, end - Date.now());
  const read = async (name) => { const b = await fs.readFile(path.join(dir, name)).catch(() => null); return b && b.length > 500 ? b : null; };
  const FAST = ['-skip_loop_filter', 'all'];
  try {
    await fs.writeFile(src, bytes);
    // The length, read from what ffmpeg says about the file.
    const info = await run(bin, ['-hide_banner', '-i', src], 8000);
    const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(info.err || '');
    const secs = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
    if (!(secs > 0) || count < 2) { // an unknown length: the first frame only
      const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...FAST, '-i', src, '-an', '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '4', path.join(dir, 'f0.jpg')], left());
      const b = r.code === 0 ? await read('f0.jpg') : null;
      return b ? [b] : [];
    }
    const at = frameTimes(secs, count), step = at[1] - at[0];
    // One pass: start at the first moment, then keep the first frame at or after each next moment (the moments are
    // counted from that start, so a late frame does not push the following ones later).
    const one = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...FAST, '-ss', at[0].toFixed(2), '-i', src, '-an',
      '-vf', `select='gte(t\\,selected_n*${step.toFixed(4)})',scale=512:-2`, '-fps_mode', 'vfr', '-frames:v', String(count), '-q:v', '4', path.join(dir, 'a%d.jpg')], left());
    const out = [];
    if (one.code === 0) for (let i = 1; i <= count; i++) { const b = await read(`a${i}.jpg`); if (b) out.push(b); }
    if (out.length === count) return out;
    // The one pass did not give every frame (an unusual file, or an ffmpeg without these options): one by one, as before.
    console.error('sample frames: the single pass gave', out.length, 'of', count, (one.err || '').trim().slice(-160));
    out.length = 0;
    for (let i = 0; i < count; i++) {
      const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', ...FAST, '-ss', at[i].toFixed(2), '-i', src, '-an', '-frames:v', '1', '-vf', 'scale=512:-2', '-q:v', '4', path.join(dir, `f${i}.jpg`)], left());
      const b = r.code === 0 ? await read(`f${i}.jpg`) : null;
      if (b) out.push(b);
    }
    return out.length < count ? [] : out; // every frame, or none: a partial look is not a check
  } catch (e) { console.error('sample frames failed:', e?.message || e); return []; }
  finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

// A light copy of a video for playing inside a small tile: at most 480 px on its short side, 24 frames a second,
// at most `seconds` long, no sound, the index at the start. Returns the bytes, or null.
export async function lightVideo(bytes, { seconds = 6, budgetMs = 30_000 } = {}) {
  const bin = await ffmpegBinary();
  if (!bin) return null;
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ppl-'));
  const src = path.join(dir, 'in.mp4'), dst = path.join(dir, 'out.mp4');
  try {
    await fs.writeFile(src, bytes);
    const scale = "scale='if(gt(iw,ih),-2,min(480,iw))':'if(gt(iw,ih),min(480,ih),-2)',scale=trunc(iw/2)*2:trunc(ih/2)*2";
    const r = await run(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-t', String(seconds), '-an', '-map', '0:v:0', '-vf', scale, '-r', '24',
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-profile:v', 'main', '-movflags', '+faststart', '-f', 'mp4', dst], budgetMs);
    if (r.code !== 0) throw new Error((r.err || `ffmpeg exit ${r.code}`).trim().slice(-240));
    const out = await fs.readFile(dst);
    return looksLikeVideo(out) ? out : null;
  } catch (e) { console.error('light video failed:', e?.message || e); return null; }
  finally { await fs.rm(dir, { recursive: true, force: true }).catch(() => {}); }
}
