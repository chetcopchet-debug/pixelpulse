// What the interface shows for each model and tool. Prices come from the same tables the server charges from.
import { t, N } from "../i18n/index.js";
import { IMAGE_MODELS, VIDEO_MODELS, RETIRED } from "../../lib/catalog.js";
import { VIDEO_PRICING, videoQuote, videoFrom, videoTakesImage } from "../../lib/videoPricing.js";
export { videoTakesImage };

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

// A list defined here is read long before a language is chosen, so its texts are marked with N("…") and
// translate themselves at the moment they are read.
const live = (o, keep = []) => {
  const out = {};
  for (const [k, v] of Object.entries(o)) Object.defineProperty(out, k, typeof v === "string" && !keep.includes(k) ? { get: () => t(v), enumerable: true } : { value: v, enumerable: true });
  return out;
};
export const IMAGE_RATIOS = [
  live({ id: "1:1", label: N("Square") }, ["id"]),
  live({ id: "9:16", label: N("Tall") }, ["id"]),
  live({ id: "16:9", label: N("Wide") }, ["id"]),
];
export const ratioLabel = (id) => (IMAGE_RATIOS.find((r) => r.id === id) || { label: id }).label;

// Tools that work on an existing image. `paidOnly` tools can't be paid for with free credits.
export const TOOLS = {
  animate: live({ label: N("Animate"), cost: 10, paidOnly: true, detail: "Wan 2.2, 5 s, 480p" }, ["detail"]),
  sharpen: live({ label: N("Upscale"), cost: 1, done: N("Upscaled to twice the size") }),
  cutout: live({ label: N("Remove background"), cost: 1, done: N("Background removed") }),
  edit: live({ label: N("Edit with words"), cost: 8, done: N("Edit applied"), ask: N("What should change?"), hint: N("Make it night, add snow, change the jacket to red") }),
  repaint: live({ label: N("Edit an area"), cost: 11, done: N("The marked part was changed") }),
  facelock: live({ label: N("Keep the face"), cost: 7, paidOnly: true, done: N("Same face, new scene"), ask: N("Describe the new scene"), hint: N("As an astronaut on Mars") }),
  reference: live({ label: N("From a reference image"), cost: 5, detail: "FLUX Dev" }, ["detail"]),
};

// Options and price for one video run. The ratio falls back to one the model supports.
// `image`: the video starts from a picture (only models that can; see videoTakesImage).
// How a video quality is named on the screen. 360p is the draft: quick and low quality, for trying an idea.
export const resLabel = (r) => (r === "360p" ? t("Draft") : r);
export function videoPlan(modelId, d, r, ratio, image = false) {
  const p = VIDEO_PRICING[modelId];
  if (!p) return null;
  const q = videoQuote(modelId, d ?? p.def.d, r ?? p.def.r, ratio, image) || videoQuote(modelId, p.def.d, p.def.r, ratio, image);
  return q ? { ...q, durations: p.durations, resolutions: p.resolutions, ratios: p.ratios } : null;
}
export const videoOptionCost = (modelId, d, r, image = false) => videoQuote(modelId, d, r, "16:9", image)?.cost ?? null;

// The Create screen shows one thing large: whatever produced a result most recently. A single image or video
// counts from the moment it finished; a comparison counts from its start and again each time one of its images
// arrives. Returns the time to compare by, or -1 for a run that has nothing to show.
export const stageTime = (r) => (r.kind === "compare" ? Math.max(r.t0 || 0, ...(r.parts || []).map((p) => p.doneAt || 0)) : r.status === "done" && r.item ? r.doneAt || 0 : -1);
export function stageOf(runs) {
  let best = null, t = -1;
  for (const r of runs) { const v = stageTime(r); if (v >= 0 && v >= t) { best = r; t = v; } }
  return best;
}
// Does this Library item answer this waiting request? Same words, same model, made after the request started
// (with a minute of slack for clocks that disagree) and not something that was already there when it started.
export const answers = (item, w, taken) => !item.video && !taken.has(item.id) && !(w.skip || []).includes(item.id)
  && item.prompt === String(w.prompt || "").trim() && item.model === w.model && Date.parse(item.at) >= w.t0 - 60_000;

// Name shown for a saved item, from the `model` column of the images table.
export function madeWith(model) {
  const id = String(model || "fast");
  if (id === "upload") return t("Your upload");
  if (id === "guided") return t("From a reference image");
  if (id === "edit") return t("Edit with words");
  if (id === "repaint") return t("Edit an area");
  if (id === "animate") return t("Animate");
  if (id === "facelock") return t("Keep the face");
  if (id.startsWith("effect:")) return t("Effect");
  if (RETIRED[id]) return RETIRED[id];
  if (id.startsWith("video:")) return (videoModels.find((m) => m.id === id.slice(6)) || { name: t("Video") }).name;
  return (imageModels.find((m) => m.id === id) || { name: t("Image") }).name;
}

export const isVideoUrl = (u) => /\.mp4(\?|$)/i.test(u || "");
export const toItem = (r) => ({
  id: r.id || null,
  url: r.public_url,
  prompt: r.prompt || "",
  title: r.title || null, // a name given by hand (the gallery); without one, the name comes from the prompt
  ratio: r.aspect_ratio || "1:1",
  model: r.model || null,
  at: r.created_at || new Date().toISOString(),
  video: isVideoUrl(r.public_url),
  project: r.project_id || null,
  featured: Boolean(r.featured_at), // shown in the Explore gallery (only the site's owner can set it)
  preview: Boolean(r.preview), // a gallery video with a light copy that can play inside its tile
});

// What a gallery tile says about how the item was made: the model's name and what one like it costs.
export function madeFor(item) {
  const id = String(item?.model || '');
  if (id.startsWith('video:')) { const m = videoModels.find((x) => x.id === id.slice(6)); return m ? { name: m.name, cost: videoPlan(m.id)?.cost ?? m.cost } : null; }
  const m = imageModels.find((x) => x.id === id);
  return m ? { name: m.name, cost: m.cost } : null;
}
