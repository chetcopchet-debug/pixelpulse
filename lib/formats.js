// Pulse Formats (shared by client and server). tpl wraps the user's idea server-side; ratio is forced; engine is a recommendation.
export const FORMAT_GROUPS = {"Social": "Social & profile", "Brand": "Brand & business", "Art": "Art & design"};
export const FORMATS = {
 "free": {
  "id": "free",
  "label": "Any",
  "icon": "◌",
  "ratio": null,
  "engine": null,
  "tpl": null,
  "blurb": "Any idea, any shape.",
  "group": null
 },
 "wallpaper": {
  "id": "wallpaper",
  "label": "Wallpaper",
  "icon": "▯",
  "group": "Art",
  "ratio": "9:16",
  "engine": "fast",
  "tpl": "{p}, phone lock-screen wallpaper, vertical composition, main subject in the lower two thirds, calm uncluttered top area, no text, no letters, no watermark",
  "blurb": "Phone lock-screen art with room for the clock."
 },
 "desktop-wallpaper": {
  "id": "desktop-wallpaper",
  "label": "Desktop Wallpaper",
  "icon": "▭",
  "group": "Art",
  "ratio": "16:9",
  "engine": "quality",
  "tpl": "{p}, widescreen desktop wallpaper, cinematic wide composition, subject off-center leaving clean negative space for icons, rich detail, no text, no watermark",
  "blurb": "Widescreen 16:9 backgrounds for laptops and monitors."
 },
 "sticker": {
  "id": "sticker",
  "label": "Sticker",
  "icon": "✂",
  "group": "Art",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "die-cut sticker of {p}, single isolated subject, centered, bold clean outline, vibrant flat colors, plain solid white background, no text",
  "blurb": "One bold subject, auto-cut to a transparent PNG.",
  "autoCutout": true
 },
 "emoji": {
  "id": "emoji",
  "label": "Emoji",
  "icon": "☺",
  "group": "Art",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "single emoji-style icon of {p}, glossy 3D cartoon emoji, centered, expressive, soft shading, plain solid white background, no text",
  "blurb": "Custom emoji-style icons with a transparent background.",
  "autoCutout": true
 },
 "avatar": {
  "id": "avatar",
  "label": "Avatar",
  "icon": "◉",
  "group": "Social",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "profile avatar of {p}, centered head and shoulders, facing the viewer, expressive face, simple soft gradient background, no text",
  "blurb": "Centered portrait that fits a circle."
 },
 "anime-avatar": {
  "id": "anime-avatar",
  "label": "Anime Avatar",
  "icon": "✧",
  "group": "Social",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "anime style profile avatar of {p}, clean cel shading, expressive eyes, centered head and shoulders, vibrant soft background, high quality anime illustration, no text",
  "blurb": "Anime-style profile pictures."
 },
 "professional-headshot": {
  "id": "professional-headshot",
  "label": "Professional Headshot",
  "icon": "◍",
  "group": "Social",
  "ratio": "1:1",
  "engine": "quality",
  "tpl": "professional corporate headshot of {p}, head and shoulders, soft studio lighting, neutral blurred office background, sharp focus on eyes, natural skin texture, photorealistic, no text",
  "blurb": "Studio-style headshots for profiles and decks."
 },
 "pet-portrait": {
  "id": "pet-portrait",
  "label": "Pet Portrait",
  "icon": "❦",
  "group": "Social",
  "ratio": "1:1",
  "engine": "quality",
  "tpl": "fine art portrait of {p}, regal studio portrait, dramatic soft lighting, rich painted background, detailed fur, centered, no text",
  "blurb": "Classic portraits of pets, real or imagined."
 },
 "youtube-thumbnail": {
  "id": "youtube-thumbnail",
  "label": "YouTube Thumbnail",
  "icon": "▶",
  "group": "Social",
  "ratio": "16:9",
  "engine": "text",
  "tpl": "eye-catching YouTube thumbnail: {p}. Bold large readable title text, high contrast, one clear focal subject, vivid saturated colors, clean composition",
  "blurb": "16:9 thumbnails with bold readable titles."
 },
 "instagram-post": {
  "id": "instagram-post",
  "label": "Instagram Post",
  "icon": "▣",
  "group": "Social",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "{p}, square social media post, scroll-stopping composition, bold color palette, clean centered subject, aesthetic, no watermark",
  "blurb": "Square scroll-stopping posts."
 },
 "story": {
  "id": "story",
  "label": "Story",
  "icon": "▮",
  "group": "Social",
  "ratio": "9:16",
  "engine": "fast",
  "tpl": "{p}, vertical story frame, immersive full-bleed composition, dramatic depth, breathing room at top and bottom for captions, no text",
  "blurb": "Full-bleed vertical frame for stories & reels."
 },
 "podcast-cover": {
  "id": "podcast-cover",
  "label": "Podcast Cover",
  "icon": "◎",
  "group": "Social",
  "ratio": "1:1",
  "engine": "text",
  "tpl": "podcast cover art: {p}. Bold readable show title, strong simple graphic, high contrast, legible at small sizes, square",
  "blurb": "Square cover art that reads at thumbnail size."
 },
 "linkedin-banner": {
  "id": "linkedin-banner",
  "label": "LinkedIn Banner",
  "icon": "▬",
  "group": "Social",
  "ratio": "16:9",
  "engine": "fast",
  "tpl": "{p}, wide professional banner background, clean abstract composition, subtle depth, calm empty area on the left third, modern, no text",
  "blurb": "Clean wide banners for profiles and pages."
 },
 "logo": {
  "id": "logo",
  "label": "Logo",
  "icon": "◆",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "text",
  "tpl": "minimal vector logo design for {p}, flat simple iconic mark, clean geometric shapes, 2 to 3 colors, centered on plain white background, professional brand identity",
  "blurb": "Simple, clean logo concepts."
 },
 "product-studio": {
  "id": "product-studio",
  "label": "AI Product Studio",
  "icon": "◇",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "quality",
  "tpl": "professional product photography of {p}, studio lighting, soft shadows, clean seamless background, commercial e-commerce shot, ultra sharp, photorealistic",
  "blurb": "Studio product shots for shops and ads."
 },
 "poster": {
  "id": "poster",
  "label": "Poster",
  "icon": "▤",
  "group": "Brand",
  "ratio": "9:16",
  "engine": "text",
  "tpl": "bold graphic poster: {p}. Large bold title typography as the focal point, striking layout, high contrast, print-ready",
  "blurb": "Bold title lettering — put your title in \"quotes\"."
 },
 "flyer": {
  "id": "flyer",
  "label": "Flyer",
  "icon": "▥",
  "group": "Brand",
  "ratio": "9:16",
  "engine": "text",
  "tpl": "event flyer design: {p}. Clear headline typography, organized layout, eye-catching illustration, bold colors, print-ready",
  "blurb": "Event and promo flyers."
 },
 "book-cover": {
  "id": "book-cover",
  "label": "Book Cover",
  "icon": "▯",
  "group": "Brand",
  "ratio": "9:16",
  "engine": "text",
  "tpl": "book cover design: {p}. Evocative central illustration, elegant title typography, genre-appropriate mood, professional publishing quality",
  "blurb": "Covers with genre mood and a clear title."
 },
 "album-cover": {
  "id": "album-cover",
  "label": "Album Cover",
  "icon": "◼",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "quality",
  "tpl": "album cover art for {p}, striking artistic square composition, strong mood, iconic central image, no text",
  "blurb": "Square art for singles and albums."
 },
 "t-shirt-design": {
  "id": "t-shirt-design",
  "label": "T-Shirt Design",
  "icon": "⛉",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "text",
  "tpl": "t-shirt print design of {p}, bold standalone graphic, clean vector illustration style, limited color palette, isolated on plain white background",
  "blurb": "Print-ready graphic tees."
 },
 "app-icon": {
  "id": "app-icon",
  "label": "App Icon",
  "icon": "▢",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "app icon for {p}, single simple bold symbol, smooth gradient, rounded square icon style, centered, minimal, no text",
  "blurb": "Simple bold icons for apps and sites."
 },
 "invitation": {
  "id": "invitation",
  "label": "Invitation",
  "icon": "✉",
  "group": "Brand",
  "ratio": "9:16",
  "engine": "text",
  "tpl": "elegant invitation card design: {p}. Beautiful decorative illustration, refined title typography, balanced layout, printable",
  "blurb": "Invitations for weddings, birthdays and parties."
 },
 "greeting-card": {
  "id": "greeting-card",
  "label": "Greeting Card",
  "icon": "❀",
  "group": "Brand",
  "ratio": "1:1",
  "engine": "text",
  "tpl": "greeting card illustration: {p}. Warm charming artwork, short friendly message lettering, soft festive colors, printable",
  "blurb": "Warm cards for any occasion."
 },
 "tattoo": {
  "id": "tattoo",
  "label": "Tattoo Design",
  "icon": "✒",
  "group": "Art",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "tattoo design flash of {p}, clean bold linework, black ink, high contrast, stencil-ready, isolated on plain white background",
  "blurb": "Ink-ready line art to take to your artist."
 },
 "coloring-page": {
  "id": "coloring-page",
  "label": "Coloring Page",
  "icon": "✏",
  "group": "Art",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "coloring book page of {p}, clean black outlines only, no shading, no color, white background, simple shapes, kid friendly line art",
  "blurb": "Printable black-and-white line art."
 },
 "pixel-art": {
  "id": "pixel-art",
  "label": "Pixel Art",
  "icon": "▦",
  "group": "Art",
  "ratio": "1:1",
  "engine": "fast",
  "tpl": "pixel art of {p}, 16-bit retro game style, crisp pixels, limited palette, clean readable sprite, no text",
  "blurb": "Retro 16-bit sprites and scenes."
 },
 "character-design": {
  "id": "character-design",
  "label": "Character Design",
  "icon": "☗",
  "group": "Art",
  "ratio": "1:1",
  "engine": "quality",
  "tpl": "character concept art of {p}, full body, clear silhouette, detailed outfit design, neutral studio background, concept sheet quality",
  "blurb": "Full-body concepts for games and stories."
 },
 "fantasy-map": {
  "id": "fantasy-map",
  "label": "Fantasy Map",
  "icon": "⌖",
  "group": "Art",
  "ratio": "16:9",
  "engine": "quality",
  "tpl": "hand-drawn fantasy world map of {p}, parchment texture, mountains forests rivers and coastlines, decorative compass rose, ink and watercolor, top-down view",
  "blurb": "Hand-drawn maps for worlds and campaigns."
 },
 "interior-design": {
  "id": "interior-design",
  "label": "Interior Design",
  "icon": "⌂",
  "group": "Art",
  "ratio": "16:9",
  "engine": "quality",
  "tpl": "interior design photograph of {p}, realistic architectural photography, natural light, styled furniture and decor, wide angle, magazine quality",
  "blurb": "Room ideas and makeovers."
 },
 "kids-book-illustration": {
  "id": "kids-book-illustration",
  "label": "Kids Book Illustration",
  "icon": "✿",
  "group": "Art",
  "ratio": "16:9",
  "engine": "fast",
  "tpl": "children's picture book illustration of {p}, warm whimsical storybook style, soft textures, gentle colors, friendly characters, no text",
  "blurb": "Whimsical storybook scenes."
 }
};
export const FORMAT_LIST = Object.values(FORMATS);
export const isFormat = (f) => typeof f === 'string' && Object.prototype.hasOwnProperty.call(FORMATS, f);
export function applyFormat(prompt, format) {
  const f = isFormat(format) ? FORMATS[format] : null;
  return f && f.tpl ? f.tpl.replace('{p}', prompt) : prompt;
}
