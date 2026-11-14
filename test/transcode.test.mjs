// Runs the real converter. Needs ffmpeg: FFMPEG_PATH, or the ffmpeg-static package after `npm install`.
// Without either the tests are skipped, not failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toWebVideo, ffmpegBinary, converterVersion, sampleFrames, frameTimes } from '../lib/transcode.js';
import { probeMp4 } from '../lib/videoJobCore.js';

const bin = await ffmpegBinary();
const dir = mkdtempSync(join(tmpdir(), 'ppt-'));
// A two-second test clip, made by ffmpeg itself in the requested encoding.
function clip(name, args) {
  const out = join(dir, `${name}.mp4`);
  const r = spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=480x832:rate=16', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '2', ...args, out]);
  assert.equal(r.status, 0, String(r.stderr));
  return readFileSync(out);
}
test.after(() => rmSync(dir, { recursive: true, force: true }));
const t = (name, fn) => test(name, { skip: bin ? false : 'ffmpeg is not installed here' }, fn);

t('the converter reports its version', async () => { assert.match(await converterVersion(), /^ffmpeg/); });

t('H.264 4:4:4 (does not play on phones) is re-made as H.264 4:2:0 with the index first', async () => {
  const src = clip('p444', ['-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-an']);
  assert.equal(probeMp4(src).web, false);
  const r = await toWebVideo(src);
  assert.equal(r.how, 'encoded'); assert.equal(r.ok, true);
  assert.deepEqual([r.after.codec, r.after.profile, r.after.web, r.after.indexFirst, r.after.width, r.after.height], ['avc1', 100, true, true, 480, 832]);
});

t('a video that is already H.264 4:2:0 only gets its index moved (no quality loss)', async () => {
  const src = clip('p420', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac']);
  assert.deepEqual([probeMp4(src).web, probeMp4(src).indexFirst], [true, false]);
  const r = await toWebVideo(src);
  assert.equal(r.how, 'repacked'); assert.equal(r.after.indexFirst, true); assert.equal(r.after.audio, 'mp4a');
  const again = await toWebVideo(r.bytes);
  assert.equal(again.how, 'kept', 'a converted video is left alone'); assert.equal(again.bytes, r.bytes);
  assert.equal((await toWebVideo(r.bytes, { always: true })).how, 'encoded', 'unless a full re-make is asked for');
});

t('an odd picture size is made even, as 4:2:0 requires', async () => {
  const out = join(dir, 'odd.mp4');
  spawnSync(bin, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=481x833:rate=16', '-t', '1', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', out]);
  const r = await toWebVideo(readFileSync(out));
  assert.equal(r.how, 'encoded'); assert.deepEqual([r.after.width, r.after.height], [480, 832]);
});

t('something that is not a video is handed back untouched and not called unplayable', async () => {
  const junk = Buffer.from('<html>not a video</html>'.padEnd(9000, ' '));
  const r = await toWebVideo(junk);
  assert.equal(r.how, 'kept'); assert.equal(r.bytes, junk);
});

// The frames for the safety check of a finished video.
test('the five frames are spread from just after the start to just before the end', () => {
  const at = frameTimes(8, 5);
  assert.equal(at.length, 5);
  assert.ok(Math.abs(at[0] - 0.24) < 1e-9 && Math.abs(at[4] - 7.76) < 1e-9);
  const short = frameTimes(2, 5);
  assert.ok(short[4] <= 1.85 + 1e-9, 'a short video is not asked for a moment past its last frame');
  assert.ok(at.every((x, i) => i === 0 || x > at[i - 1]));
});
t('five frames come out of a video that has a single key frame (what Veo writes at 1080p)', async () => {
  const src = clip('onekey', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '9999', '-keyint_min', '9999', '-sc_threshold', '0', '-c:a', 'aac']);
  const frames = await sampleFrames(src, 5, { budgetMs: 20_000 });
  assert.equal(frames.length, 5);
  for (const f of frames) assert.ok(f[0] === 0xff && f[1] === 0xd8, 'each frame is a JPEG');
  assert.equal(new Set(frames.map((f) => f.toString('base64'))).size, 5, 'five different moments');
});
t('five frames come out of an ordinary video too, and a broken file gives none', async () => {
  const src = clip('plain', ['-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-g', '8', '-c:a', 'aac']);
  assert.equal((await sampleFrames(src, 5)).length, 5);
  assert.equal((await sampleFrames(Buffer.from('not a video at all'), 5)).length, 0);
});
