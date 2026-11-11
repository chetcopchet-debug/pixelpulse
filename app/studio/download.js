// Saving a result to the device. Free downloads carry a small "PixelPulse" mark; buyers and admins get clean files.
let markOn = false;
export const setDownloadMark = (on) => { markOn = Boolean(on); };

async function addMark(blob) {
  const bmp = await createImageBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(bmp, 0, 0); bmp.close?.();
  const fs = Math.max(13, Math.round(Math.min(w, h) * 0.032)), pad = Math.round(fs * 0.9);
  g.font = `700 ${fs}px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif`; g.textBaseline = "middle";
  const text = "PixelPulse", tw = g.measureText(text).width, r = fs * 0.28;
  const x = w - pad - tw, y = h - pad - fs * 0.5;
  g.shadowColor = "rgba(0,0,0,.45)"; g.shadowBlur = fs * 0.35;
  g.globalAlpha = 0.7; g.fillStyle = "#fff"; g.fillText(text, x, y);
  g.globalAlpha = 0.9; g.fillStyle = "#FFC928"; g.beginPath(); g.arc(x - r * 2.4, y, r, 0, Math.PI * 2); g.fill();
  const png = blob.type === "image/png";
  return await new Promise((res) => c.toBlob((o) => res(o || blob), png ? "image/png" : "image/jpeg", 0.94));
}

export async function download(item) {
  const name = `pixelpulse-${(item.id || String(Date.now())).slice(0, 8)}`;
  try {
    const r = await fetch(item.url, { cache: "no-store" });
    let b = await r.blob();
    if (markOn && b.type.startsWith("image/")) b = await addMark(b).catch(() => b);
    const ext = (b.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const u = URL.createObjectURL(b);
    const a = document.createElement("a"); a.href = u; a.download = `${name}.${ext}`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 4000);
  } catch { window.open(item.url, "_blank"); }
}
