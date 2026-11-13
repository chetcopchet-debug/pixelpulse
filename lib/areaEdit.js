// Edit an area, the picture work (see lib/areaPlan.js for the idea).
//   prepareArea(image, mask) -> what to send to the model: the cut-out part and its mask, at the model's size
//   finishArea(prep, modelOutput) -> the original image with only the marked part replaced
import sharp from 'sharp';
import { maskBox, planArea } from './areaPlan.js';

const gray1 = (width, height) => ({ raw: { width, height, channels: 1 } });

export async function prepareArea(imageBytes, maskBytes) {
  // A phone photo can be stored sideways with a note saying how to turn it. The browser showed it turned, and the
  // marking was painted on that, so turn the pixels first.
  const meta = await sharp(imageBytes, { failOn: 'none' }).metadata();
  const turned = (meta.orientation || 1) > 1;
  const base = turned ? await sharp(imageBytes, { failOn: 'none' }).rotate().png().toBuffer() : imageBytes;
  const size = turned ? await sharp(base).metadata() : meta;
  const W = size.width, H = size.height;
  if (!W || !H) return { error: 'image' };

  // The marking as one byte per pixel, at the image's size (white = change).
  const gray = await sharp(maskBytes, { failOn: 'none' }).flatten({ background: '#000000' }).resize(W, H, { fit: 'fill' }).extractChannel(0).raw().toBuffer();
  const box = maskBox(gray, W, H);
  if (!box) return { error: 'empty' };
  const plan = planArea({ w: W, h: H, box });
  const { crop, model } = plan;
  const cut = { left: crop.x, top: crop.y, width: crop.w, height: crop.h };

  const image = await sharp(base, { failOn: 'none' }).extract(cut).flatten({ background: '#FFFFFF' })
    .resize(model.w, model.h, { fit: 'fill', kernel: 'lanczos3' }).jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toBuffer();
  // The model repaints a little past the marking, so the seam falls on pixels it made to fit: the marking is
  // blurred outward and then cut back to pure black and white. Two steps, because sharp would otherwise apply the
  // cut before the blur and send a grey, soft-edged mask.
  const grow = Math.max(2, Math.min(model.w, model.h) * 0.008);
  const soft = await sharp(gray, gray1(W, H)).extract(cut).resize(model.w, model.h, { fit: 'fill' }).blur(grow).extractChannel(0).raw().toBuffer();
  const mask = await sharp(soft, gray1(model.w, model.h)).threshold(40).png().toBuffer();

  return { base, W, H, gray, plan, image, mask, alpha: Boolean(size.hasAlpha), marked: box.count / (W * H) };
}

// The same mask with black and white swapped, for models that read it the other way round (black = change).
export const swapMask = (mask) => sharp(mask).negate({ alpha: false }).png().toBuffer();

export async function finishArea(prep, outputBytes) {
  const { base, W, H, gray, plan, alpha } = prep;
  const { crop } = plan;
  const cut = { left: crop.x, top: crop.y, width: crop.w, height: crop.h };
  const rgb = await sharp(outputBytes, { failOn: 'none' }).resize(crop.w, crop.h, { fit: 'fill', kernel: 'lanczos3' }).removeAlpha().toColourspace('srgb').raw().toBuffer();
  // How much of the new pixels to use at each point: all of it inside the marking, fading out over a few pixels.
  const feather = Math.max(1.5, Math.min(crop.w, crop.h) * 0.012);
  const fade = await sharp(gray, gray1(W, H)).extract(cut).blur(feather).linear(1.7, 0).extractChannel(0).raw().toBuffer(); // one byte per pixel again (sharp widens grey to three channels)
  const patch = await sharp(rgb, { raw: { width: crop.w, height: crop.h, channels: 3 } }).joinChannel(fade, gray1(crop.w, crop.h)).png().toBuffer();
  const out = sharp(base, { failOn: 'none' }).composite([{ input: patch, left: crop.x, top: crop.y }]);
  return alpha
    ? { bytes: await out.png().toBuffer(), contentType: 'image/png', width: W, height: H }
    : { bytes: await out.webp({ quality: 95 }).toBuffer(), contentType: 'image/webp', width: W, height: H };
}
