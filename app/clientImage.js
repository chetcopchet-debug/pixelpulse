"use client";
// Robust client-side photo preparation for uploads (Android/iOS galleries, HEIC, huge photos).
const MAX_SIDE = 1536;
const MAX_CANVAS_AREA = 16_000_000; // stay under mobile canvas limits

export class UploadError extends Error {}

async function sniff(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const s = (a, z) => String.fromCharCode(...b.slice(a, z));
    if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
    if (b[0] === 0x89 && s(1, 4) === "PNG") return "image/png";
    if (s(0, 4) === "RIFF" && s(8, 12) === "WEBP") return "image/webp";
    if (s(0, 3) === "GIF") return "image/gif";
    if (s(4, 8) === "ftyp") {
      const brand = s(8, 12).toLowerCase();
      if (brand.startsWith("avi")) return "image/avif";
      return "image/heic";
    }
    return null;
  } catch { return null; }
}

async function decode(blob) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(blob, { imageOrientation: "from-image" }); } catch {}
    try { return await createImageBitmap(blob); } catch {}
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("img decode failed")); img.src = url; });
    try { await img.decode?.(); } catch {}
    if (!img.naturalWidth) throw new Error("zero size");
    return img;
  } finally { setTimeout(() => URL.revokeObjectURL(url), 30_000); }
}

function downscale(src) {
  const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
  if (!w0 || !h0) throw new Error("zero size");
  const target = Math.min(1, MAX_SIDE / Math.max(w0, h0));
  const tw = Math.max(1, Math.round(w0 * target)), th = Math.max(1, Math.round(h0 * target));
  let cur = src, cw = w0, ch = h0;
  // Step down by halves (better quality, avoids one giant canvas) and keep each canvas within limits.
  while (cw / 2 >= tw || cw * ch > MAX_CANVAS_AREA) {
    const nw = Math.max(tw, Math.round(cw / 2)), nh = Math.max(th, Math.round(ch / 2));
    if (nw === cw && nh === ch) break;
    const c = document.createElement("canvas"); c.width = nw; c.height = nh;
    const x = c.getContext("2d"); x.imageSmoothingQuality = "high"; x.drawImage(cur, 0, 0, nw, nh);
    cur = c; cw = nw; ch = nh;
  }
  const out = document.createElement("canvas"); out.width = tw; out.height = th;
  const ctx = out.getContext("2d"); ctx.imageSmoothingQuality = "high";
  return { canvas: out, ctx, cur, tw, th };
}

const toBlob = (c, type, q) => new Promise((res) => c.toBlob((b) => res(b), type, q));
const blobToDataUrl = (b) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });

// Returns { data } (data URL, already downscaled) or { raw: Blob } when the browser can't decode it.
export async function prepareUpload(file) {
  if (!file) throw new UploadError("No file selected.");
  if (!file.size) throw new UploadError("That file is empty. If it lives in Google Photos/cloud, download it to the phone first.");
  const sniffed = await sniff(file);
  const name = (file.name || "").toLowerCase();
  const isHeic = /hei[cf]/.test(file.type || "") || /\.hei[cf]$/.test(name) || sniffed === "image/heic";
  if (!sniffed && !/^image\//.test(file.type || "")) throw new UploadError("That file isn't an image. Choose a JPG, PNG or WebP photo.");

  let blob = file;
  if (isHeic) {
    try {
      const { default: heic2any } = await import("heic2any");
      const conv = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
      blob = Array.isArray(conv) ? conv[0] : conv;
    } catch (e) { console.warn("heic2any failed", e); }
  }
  let src;
  try { src = await decode(blob); } catch (e) {
    console.warn("decode failed, falling back to server", e);
    return { raw: file, isHeic };
  }
  try {
    const { canvas, ctx, cur, tw, th } = downscale(src);
    const png = sniffed === "image/png" && !isHeic;
    if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, tw, th); }
    ctx.drawImage(cur, 0, 0, tw, th);
    src.close?.();
    let out = await toBlob(canvas, png ? "image/png" : "image/jpeg", 0.88);
    if (!out || out.size > 2.8e6) out = await toBlob(canvas, "image/jpeg", 0.82);
    if (!out) return { raw: file, isHeic };
    return { data: await blobToDataUrl(out) };
  } catch (e) {
    console.warn("canvas step failed, falling back to server", e);
    return { raw: file, isHeic };
  }
}

// Send original bytes to the server for conversion (signed storage URL, else direct body).
export async function uploadRaw(file, uploadId) {
  const idh = uploadId ? { "x-upload-id": uploadId } : {};
  if (file.size > 8 * 1024 * 1024) throw new UploadError("This photo is too large to convert (max 8MB). Try a screenshot of it, or a smaller photo.");
  try {
    const s = await fetch("/api/upload/sign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: file.size, type: file.type || "application/octet-stream" }) });
    const sd = await s.json().catch(() => ({}));
    if (s.ok && sd.signedUrl) {
      const put = await fetch(sd.signedUrl, { method: "PUT", headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "true" }, body: file });
      if (put.ok) {
        const r = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json", ...idh }, body: JSON.stringify({ tmpPath: sd.tmpPath }) });
        return r;
      }
    }
  } catch (e) { console.warn("signed upload failed", e); }
  if (file.size > 4.3 * 1024 * 1024) throw new UploadError("Couldn't send this photo for conversion. Try a smaller photo or a JPG.");
  return fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/octet-stream", ...idh }, body: file });
}
