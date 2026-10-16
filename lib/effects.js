// Pulse Effects catalog (client-safe: no prompts here). One photo + one tap -> a 5s 9:16 clip.
// All run on wan-video/wan-2.2-i2v-fast (PREMIUM.animate pricing). Prompts live server-side in lib/effectPrompts.js.
export const EFFECT_COST = 15;
export const EFFECTS = [
  { id: 'superhero', name: 'Hero Rise', icon: '🦸', blurb: 'Glowing suit, cape, lift-off', fx: 'rise', c: ['#7c3aed', '#f59e0b'] },
  { id: 'particles', name: 'Disintegrate', icon: '✨', blurb: 'Bursts into glowing dust', fx: 'dust', c: ['#0ea5e9', '#a855f7'] },
  { id: 'anime', name: 'Anime Shift', icon: '🌸', blurb: 'Turns into an anime scene', fx: 'shift', c: ['#ec4899', '#38bdf8'] },
  { id: 'dance', name: 'Dance Pulse', icon: '💃', blurb: 'Breaks into a groovy dance', fx: 'dance', c: ['#f43f5e', '#facc15'] },
  { id: 'space', name: 'Zoom to Space', icon: '🌍', blurb: 'Camera flies up to orbit', fx: 'zoomout', c: ['#1e3a8a', '#0f172a'] },
  { id: 'melt', name: 'Melt Down', icon: '🫠', blurb: 'Melts like hot wax', fx: 'melt', c: ['#f97316', '#db2777'] },
  { id: 'statue', name: 'Turn to Stone', icon: '🗿', blurb: 'Becomes a marble statue', fx: 'stone', c: ['#a8a29e', '#57534e'] },
  { id: 'inflate', name: 'Inflate', icon: '🎈', blurb: 'Puffs up like a balloon', fx: 'inflate', c: ['#22d3ee', '#f472b6'] },
  { id: 'fire', name: 'Flame On', icon: '🔥', blurb: 'Engulfed in epic fire aura', fx: 'flame', c: ['#ef4444', '#f59e0b'] },
  { id: 'cyborg', name: 'Cyborg', icon: '🤖', blurb: 'Skin peels to chrome robot', fx: 'scan', c: ['#06b6d4', '#334155'] },
  { id: 'gold', name: 'Midas Touch', icon: '👑', blurb: 'Turns to shining gold', fx: 'shine', c: ['#eab308', '#92400e'] },
  { id: 'hug', name: 'Pet Hug', icon: '🐶', blurb: 'A puppy jumps in for a hug', fx: 'hop', c: ['#84cc16', '#f59e0b'] },
];
export const effectById = (id) => EFFECTS.find((e) => e.id === id) || null;
