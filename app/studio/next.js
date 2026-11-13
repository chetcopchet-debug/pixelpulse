// "What next": everything that can be done with a finished image, with its price. One list, used by the
// Create screen and by the full-screen viewer, so the two never disagree. `short` is the label for the small
// tiles on a phone.
import { t } from "../i18n/index.js";
import { imageModel, imageModels, TOOLS } from "./models";

export function nextActions(s, item) {
  const again = imageModel(imageModels.some((m) => m.id === item.model) ? item.model : "fast").cost;
  return [
    { key: "animate", short: t("Animate"), icon: "film", label: TOOLS.animate.label, cost: TOOLS.animate.cost, hint: t("Turn it into a 5 second video"), run: () => s.animate(item) },
    { key: "sharpen", short: t("Upscale"), icon: "upscale", label: TOOLS.sharpen.label, cost: TOOLS.sharpen.cost, hint: t("Twice the size, sharper"), run: () => s.runTool("sharpen", item) },
    { key: "repaint", short: t("Edit area"), icon: "brush", label: TOOLS.repaint.label, cost: TOOLS.repaint.cost, hint: t("Paint over a part and replace it"), run: () => s.setArea(item) },
    { key: "edit", short: t("Edit"), icon: "edit", label: TOOLS.edit.label, cost: TOOLS.edit.cost, hint: t("Say what should change"), run: () => s.setSheet({ type: "ask", tool: "edit", item }) },
    { key: "variations", short: t("Variation"), icon: "variations", label: t("Another version"), cost: again, hint: t("Same prompt, new result"), run: () => s.variations(item) },
    { key: "cutout", short: t("Cut out"), icon: "eraser", label: TOOLS.cutout.label, cost: TOOLS.cutout.cost, hint: t("Keep only the subject"), run: () => s.runTool("cutout", item) },
    { key: "facelock", short: t("Keep face"), icon: "face", label: TOOLS.facelock.label, cost: TOOLS.facelock.cost, hint: t("Same face, new scene"), run: () => s.setSheet({ type: "ask", tool: "facelock", item }) },
  ];
}
