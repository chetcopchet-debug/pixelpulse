// Daily Pulse: one global theme per UTC day (resets with credits at 00:00 UTC = 03:00 Israel summer time).
export const THEMES = [
  ['Underwater city at golden hour', 'wallpaper'], ['A fox made of autumn leaves', 'sticker'], ['Robot gardener', 'avatar'],
  ['"NIGHT MARKET" neon festival', 'poster'], ['Train window to another world', 'story'], ['Glass greenhouse on the moon', 'wallpaper'],
  ['Tiny dragon drinking coffee', 'sticker'], ['Your spirit animal as a knight', 'avatar'], ['"SUMMER PULSE" beach rave', 'poster'],
  ['Lantern-lit mountain path', 'story'], ['Aurora over a frozen lake', 'wallpaper'], ['Happy cactus with sunglasses', 'sticker'],
  ['Cyberpunk grandma', 'avatar'], ['"LOST IN SPACE" retro movie', 'poster'], ['Rooftop garden in the rain', 'story'],
  ['Jellyfish sky', 'wallpaper'], ['Pizza slice astronaut', 'sticker'], ['Elf mechanic', 'avatar'], ['"JAZZ AFTER DARK"', 'poster'],
  ['Desert caravan under two moons', 'story'], ['Bioluminescent forest', 'wallpaper'], ['Grumpy cloud', 'sticker'],
  ['Pirate cat captain', 'avatar'], ['"SAVE THE BEES" campaign', 'poster'], ['Midnight ramen shop', 'story'],
  ['Floating islands at dawn', 'wallpaper'], ['Boba tea monster', 'sticker'], ['Steampunk inventor', 'avatar'],
  ['"GAME OVER" arcade night', 'poster'], ['Lighthouse in a storm', 'story'], ['Paper-cut ocean waves', 'wallpaper'],
  ['Skateboarding penguin', 'sticker'], ['Forest witch with a crow', 'avatar'], ['"TOKYO 2099"', 'poster'],
  ['Hot air balloons over canyons', 'story'], ['Crystal cave glow', 'wallpaper'], ['Sleepy moon with nightcap', 'sticker'],
  ['Samurai frog', 'avatar'], ['"OPEN MIC NIGHT"', 'poster'], ['Snowy cabin with warm windows', 'story'],
  ['Synthwave sunset highway', 'wallpaper'], ['Avocado superhero', 'sticker'], ['Astronaut with flower helmet', 'avatar'],
  ['"PLANT PARTY" market', 'poster'], ['Venice canals in the future', 'story'], ['Sakura storm', 'wallpaper'],
  ['Rubber duck viking', 'sticker'], ['Desert nomad in mirrored goggles', 'avatar'], ['"MIDNIGHT RUN" sneaker drop', 'poster'],
  ['Library inside a giant tree', 'story'], ['Minimal mountains in fog', 'wallpaper'], ['Lucky cat with headphones', 'sticker'],
  ['Clockwork owl', 'avatar'], ['"DREAM BIG" motivational', 'poster'], ['Neon koi pond', 'story'],
  ['Galaxy inside a jar', 'wallpaper'], ['Taco DJ', 'sticker'], ['Deep-sea diver with glowing visor', 'avatar'],
  ['"SPACE CAFE" grand opening', 'poster'], ['Cozy bookshop on a rainy street', 'story'],
].map(([text, format]) => ({ text, format }));

export const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
export const shiftDay = (key, n) => dayKey(new Date(Date.parse(`${key}T00:00:00Z`) + n * 86400000));
export function themeFor(key) {
  const n = Math.floor(Date.parse(`${key}T00:00:00Z`) / 86400000);
  return THEMES[((n * 23) % THEMES.length + THEMES.length) % THEMES.length]; // 23 is coprime with 60: full cycle, varied order
}
export function nextPulseAt(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}
