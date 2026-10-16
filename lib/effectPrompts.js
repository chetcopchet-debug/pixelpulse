// Server-only tuned prompts for Pulse Effects (wan-2.2-i2v-fast, 81 frames @16fps, 5s).
// Wan follows short, concrete, time-ordered motion descriptions best; keep identity anchors.
const KEEP = 'same person, same face, consistent identity, smooth motion, vertical cinematic shot, high detail';
export const EFFECT_PROMPTS = {
  superhero: `the person transforms into a superhero: a glowing armored suit forms over their body from the chest outward, a red cape unfurls and billows in the wind, eyes glow, then they lift off the ground and rise into the sky, dramatic lighting, sparks, ${KEEP}`,
  particles: `the subject slowly disintegrates into thousands of glowing particles and dust that swirl away in the wind from the edges inward, sparkles drifting, dark dramatic background, ${KEEP}`,
  anime: `the scene smoothly morphs into a vibrant 2D anime style, cel shading, big expressive anime eyes, cherry blossom petals flying, hair blowing in the wind, studio anime look, ${KEEP}`,
  dance: `the person starts dancing energetically to music, grooving hips and shoulders, arms moving rhythmically, happy expression, colorful party lights pulsing, full body motion, ${KEEP}`,
  space: `the camera rapidly pulls back and flies upward away from the subject, revealing the city, then the clouds, then the whole planet Earth from orbit, stars appear, continuous smooth zoom out`,
  melt: `the subject slowly melts like hot colorful wax, dripping downward from the top, surreal liquid flowing, glossy drips, everything stays in frame, ${KEEP}`,
  statue: `the person slowly turns into a white marble statue, stone texture spreading across the skin and clothes from the feet upward, motion freezes, museum lighting, cracks of dust, ${KEEP}`,
  inflate: `the subject inflates like a balloon, puffing up and becoming round and shiny, gently floating upward off the ground, funny cartoon physics, ${KEEP}`,
  fire: `the person bursts into a powerful aura of roaring flames that swirl around their body without burning them, glowing embers flying, eyes glowing orange, epic heroic moment, ${KEEP}`,
  cyborg: `the person's skin peels away in glowing panels revealing a shiny chrome robotic cyborg underneath, blue lights pulsing, mechanical parts moving, sci-fi, ${KEEP}`,
  gold: `the subject slowly turns into shining polished solid gold, the golden surface spreading from the hand across the body, glittering reflections and sparkles, luxurious lighting, ${KEEP}`,
  hug: `a cute fluffy puppy jumps into the frame and the person hugs it warmly, both smiling, heartwarming moment, soft lighting, ${KEEP}`,
};
