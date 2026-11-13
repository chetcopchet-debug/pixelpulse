import { t, N } from "../i18n";
import { thumbUrl, posterUrl } from "../../lib/thumbs";

// Starting points for someone who has not made anything yet. The card shows a short title; a tap fills the
// prompt box with the full text. The pictures are in public/ideas.
export const IDEAS = {
  image: [
    { img: "aurora", title: N("Aurora over a frozen lake"), prompt: "Aurora over a frozen lake at night, mountains reflected in the ice, flat vector illustration in teal and navy" },
    { img: "cabin", title: N("A cozy cabin in falling snow"), prompt: "A cozy cabin in falling snow, warm light in the windows, pine trees, full moon, flat illustration" },
    { img: "sneaker", title: N("Product photo of a sneaker"), prompt: "Product photo of a white sneaker with iridescent panels on a wooden table, shallow depth of field, soft daylight" },
    { img: "lighthouse", title: N("A lighthouse in a storm"), prompt: "A lighthouse in a storm at night, its beam cutting across dark waves, flat illustration, muted teal" },
    { img: "neon", title: N("Neon beach at night"), prompt: "A lone figure on a beach at night, glowing pink sun on the horizon, neon reflections in the wet sand, synthwave" },
    { img: "balloons", title: N("Hot air balloons over a canyon"), prompt: "Hot air balloons drifting over a red rock canyon at sunrise, layered paper-cut illustration, warm colors" },
  ],
  video: [
    { img: "aurora", title: N("Aurora over a frozen lake"), prompt: "Aurora over a frozen lake at night, the lights ripple slowly and reflect on the ice" },
    { img: "balloons", title: N("Balloons drifting over a canyon"), prompt: "Hot air balloons drifting over a canyon at sunrise, slow camera move to the right" },
    { img: "lighthouse", title: N("A lighthouse in a storm"), prompt: "Waves crashing around a lighthouse in a storm, the beam of light sweeps across the sea" },
    { img: "cabin", title: N("Snow falling on a cabin"), prompt: "Snow falling on a cabin at night, smoke rising from the chimney, warm light in the windows" },
    { img: "neon", title: N("Neon beach at night"), prompt: "A lone figure walks along a neon-lit beach at night, gentle waves, slow push in" },
    { img: "sneaker", title: N("A sneaker turning on a table"), prompt: "A white sneaker slowly rotating on a wooden table, shallow depth of field, soft daylight" },
  ],
};

// The six cards to show. Real results chosen for the Explore gallery come first (an image made on this site says
// more than an illustration); the drawn starting ideas fill whatever is missing.
export function ideaCards(chosen, video) {
  const real = (chosen || []).filter((x) => Boolean(x.video) === Boolean(video) && x.prompt && (video ? posterUrl(x.url) : x.url)).slice(0, 6)
    .map((x) => ({ key: x.id, src: video ? posterUrl(x.url) : thumbUrl(x.url), title: x.prompt, prompt: x.prompt }));
  const drawn = IDEAS[video ? "video" : "image"].map((x) => ({ key: x.img, src: `/ideas/${x.img}.webp`, title: t(x.title), prompt: x.prompt }));
  return [...real, ...drawn].slice(0, 6);
}
