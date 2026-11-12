// "What next": everything that can be done with a finished image, with its price. One list, used by the
// Create screen and by the full-screen viewer, so the two never disagree.
import { imageModel, imageModels, TOOLS } from "./models";

export function nextActions(s, item) {
  const again = imageModel(imageModels.some((m) => m.id === item.model) ? item.model : "fast").cost;
  return [
    { key: "animate", icon: "film", label: TOOLS.animate.label, cost: TOOLS.animate.cost, hint: "Turn it into a 5 second video", run: () => s.animate(item) },
    { key: "sharpen", icon: "upscale", label: TOOLS.sharpen.label, cost: TOOLS.sharpen.cost, hint: "Twice the size, sharper", run: () => s.runTool("sharpen", item) },
    { key: "repaint", icon: "brush", label: TOOLS.repaint.label, cost: TOOLS.repaint.cost, hint: "Paint over a part and replace it", run: () => s.setArea(item) },
    { key: "edit", icon: "edit", label: TOOLS.edit.label, cost: TOOLS.edit.cost, hint: "Say what should change", run: () => s.setSheet({ type: "ask", tool: "edit", item }) },
    { key: "variations", icon: "variations", label: "Another version", cost: again, hint: "Same prompt, new result", run: () => s.variations(item) },
    { key: "cutout", icon: "eraser", label: TOOLS.cutout.label, cost: TOOLS.cutout.cost, hint: "Keep only the subject", run: () => s.runTool("cutout", item) },
    { key: "facelock", icon: "face", label: TOOLS.facelock.label, cost: TOOLS.facelock.cost, hint: "Same face, new scene", run: () => s.setSheet({ type: "ask", tool: "facelock", item }) },
  ];
}
