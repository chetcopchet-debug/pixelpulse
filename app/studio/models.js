// What the interface shows for each model and tool. Prices come from the same tables the server charges from.
import { IMAGE_MODELS, VIDEO_MODELS, RETIRED } from "../../lib/catalog.js";
import { VIDEO_PRICING, videoQuote, videoFrom } from "../../lib/videoPricing.js";

export const imageModels = IMAGE_MODELS.map((m) => ({ id: m.id, name: m.label, by: m.by, desc: m.desc, cost: m.cost }));
export const videoModels = VIDEO_MODELS.map((m) => ({ id: m.id, name: m.label, by: m.by, desc: m.desc, cost: m.cost, from: videoFrom(m.id).cost, eta: m.eta || 120 }));
// Comparing: one prompt, one image from each chosen model. Each image is charged at its model's own price.
export const MAX_COMPARE = 4;
export function comparePlan(ids) {
  const seen = new Set(); const models = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const m = imageModels.find((x) => x.id === id);
    if (m && !seen.has(m.id) && models.length < MAX_COMPARE) { seen.add(m.id); models.push(m); }
  }
  return models.length >= 2 ? { models, cost: models.reduce((n, m) => n + m.cost, 0) } : null;
}
// Whether a wallet covers a list of charges made one after another. The server pays each one from a single pocket
// (free credits if they cover it, otherwise bought credits), never a mix.
export function covers(wallet, costs) {
  let free = wallet.free || 0, paid = wallet.paid || 0;
  for (const c of costs) { if (free >= c) free -= c; else if (paid >= c) paid -= c; else return false; }
  return true;
}
export const imageModel = (id) => imageModels.find((m) => m.id === id) || imageModels.find((m) => m.id === "fast");
export const videoModel = (id) => videoModels.find((m) => m.id === id) || videoModels[0];

export const IMAGE_RATIOS = [
  { id: "1:1", label: "Square" },
  { id: "9:16", label: "Tall" },
  { id: "16:9", label: "Wide" },
];
export const ratioLabel = (id) => (IMAGE_RATIOS.find((r) => r.id === id) || { label: id }).label;

// Tools that work on an existing image. `paidOnly` tools can't be paid for with free credits.
export const TOOLS = {
  animate: { label: "Animate", cost: 15, paidOnly: true, detail: "Wan 2.2, 5 s, 480p" },
  sharpen: { label: "Upscale", cost: 1, done: "Upscaled to twice the size" },
  cutout: { label: "Remove background", cost: 1, done: "Background removed" },
  edit: { label: "Edit with words", cost: 8, done: "Edit applied", ask: "What should change?", hint: "Make it night, add snow, change the jacket to red" },
  facelock: { label: "Keep the face", cost: 7, paidOnly: true, done: "Same face, new scene", ask: "Describe the new scene", hint: "As an astronaut on Mars" },
  reference: { label: "From a reference image", cost: 5, detail: "FLUX Dev" },
};

// Options and price for one video run. The ratio falls back to one the model supports.
export function videoPlan(modelId, d, r, ratio) {
  const p = VIDEO_PRICING[modelId];
  if (!p) return null;
  const q = videoQuote(modelId, d ?? p.def.d, r ?? p.def.r, ratio) || videoQuote(modelId, p.def.d, p.def.r, ratio);
  return q ? { ...q, durations: p.durations, resolutions: p.resolutions, ratios: p.ratios } : null;
}
export const videoOptionCost = (modelId, d, r) => videoQuote(modelId, d, r, "16:9")?.cost ?? null;

// Name shown for a saved item, from the `model` column of the images table.
export function madeWith(model) {
  const id = String(model || "fast");
  if (id === "upload") return "Your upload";
  if (id === "guided") return "From a reference image";
  if (id === "edit") return "Edit with words";
  if (id === "animate") return "Animate";
  if (id === "facelock") return "Keep the face";
  if (id.startsWith("effect:")) return "Effect";
  if (RETIRED[id]) return RETIRED[id];
  if (id.startsWith("video:")) return (videoModels.find((m) => m.id === id.slice(6)) || { name: "Video" }).name;
  return (imageModels.find((m) => m.id === id) || { name: "Image" }).name;
}

export const isVideoUrl = (u) => /\.mp4(\?|$)/i.test(u || "");
export const toItem = (r) => ({
  id: r.id || null,
  url: r.public_url,
  prompt: r.prompt || "",
  ratio: r.aspect_ratio || "1:1",
  model: r.model || null,
  at: r.created_at || new Date().toISOString(),
  video: isVideoUrl(r.public_url),
  project: r.project_id || null,
});
