// Pulse Formats (shared by client and server). tpl wraps the user's idea; ratio is forced; engine is a recommendation.
export const FORMATS = {
  free: { id: 'free', label: 'Free', icon: '◌', ratio: null, engine: null, tpl: null,
    blurb: 'Any idea, any shape.' },
  wallpaper: { id: 'wallpaper', label: 'Wallpaper', icon: '▯', ratio: '9:16', engine: 'fast',
    tpl: '{p}, phone lock-screen wallpaper, vertical composition, main subject in the lower two thirds, calm uncluttered top area, no text, no letters, no watermark',
    blurb: 'Phone lock-screen art with room for the clock.',
    seo: 'Free AI phone wallpaper generator — vertical 9:16 lock-screen art with a clean top for your clock.' },
  sticker: { id: 'sticker', label: 'Sticker', icon: '✂', ratio: '1:1', engine: 'fast', autoCutout: true,
    tpl: 'die-cut sticker of {p}, single isolated subject, centered, bold clean outline, vibrant flat colors, plain solid white background, no text',
    blurb: 'One bold subject, auto-cut to a transparent PNG.',
    seo: 'Free AI sticker maker — one isolated subject, automatically cut out to a transparent PNG.' },
  avatar: { id: 'avatar', label: 'Avatar', icon: '◉', ratio: '1:1', engine: 'fast',
    tpl: 'profile avatar of {p}, centered head and shoulders, facing the viewer, expressive face, simple soft gradient background, no text',
    blurb: 'Centered portrait that fits a circle.',
    seo: 'Free AI avatar maker — centered portraits and characters that look great in a circle.' },
  poster: { id: 'poster', label: 'Poster', icon: '▤', ratio: '9:16', engine: 'text',
    tpl: 'bold graphic poster: {p}. Large bold title typography as the focal point, striking layout, high contrast, print-ready',
    blurb: 'Bold title lettering — put your title in "quotes".',
    seo: 'Free AI poster maker — bold title typography rendered by the Text engine.' },
  story: { id: 'story', label: 'Story', icon: '▮', ratio: '9:16', engine: 'fast',
    tpl: '{p}, vertical story frame, immersive full-bleed composition, dramatic depth, breathing room at top and bottom for captions, no text',
    blurb: 'Full-bleed vertical frame for stories & reels.',
    seo: 'Free AI story image generator — full-bleed 9:16 frames for stories and reels.' },
};
export const FORMAT_LIST = Object.values(FORMATS);
export const isFormat = (f) => typeof f === 'string' && Object.prototype.hasOwnProperty.call(FORMATS, f);
export function applyFormat(prompt, format) {
  const f = isFormat(format) ? FORMATS[format] : null;
  return f && f.tpl ? f.tpl.replace('{p}', prompt) : prompt;
}
