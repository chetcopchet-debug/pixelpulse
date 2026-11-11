// Runs the real converter. Needs ffmpeg: FFMPEG_PATH, or the ffmpeg-static package after `npm install`.
// Without either the tests are skipped, not failed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { toWebVideo, ffmpegBinary, converterVersion } from '../lib/transcode.js';
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
