// Icon outlines from Lucide (ISC License, https://lucide.dev). Kept inline so the interface has no icon dependency.
const P = {
 "folder": "<path d=\"M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z\"></path>",
 "compass": "<path d=\"m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z\"></path><circle cx=\"12\" cy=\"12\" r=\"10\"></circle>",
 "create": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\"></rect><path d=\"M8 12h8\"></path><path d=\"M12 8v8\"></path>",
 "library": "<path d=\"M18 22H4a2 2 0 0 1-2-2V6\"></path><path d=\"m22 13-1.296-1.296a2.41 2.41 0 0 0-3.408 0L11 18\"></path><circle cx=\"12\" cy=\"8\" r=\"2\"></circle><rect width=\"16\" height=\"16\" x=\"6\" y=\"2\" rx=\"2\"></rect>",
 "user": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><circle cx=\"12\" cy=\"10\" r=\"3\"></circle><path d=\"M7 20.662V19a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v1.662\"></path>",
 "image": "<rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" ry=\"2\"></rect><circle cx=\"9\" cy=\"9\" r=\"2\"></circle><path d=\"m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21\"></path>",
 "video": "<path d=\"m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5\"></path><rect x=\"2\" y=\"6\" width=\"14\" height=\"12\" rx=\"2\"></rect>",
 "down": "<path d=\"m6 9 6 6 6-6\"></path>",
 "right": "<path d=\"m9 18 6-6-6-6\"></path>",
 "left": "<path d=\"m12 19-7-7 7-7\"></path><path d=\"M19 12H5\"></path>",
 "x": "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>",
 "heart": "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"></path>",
 "more": "<circle cx=\"12\" cy=\"12\" r=\"1\"></circle><circle cx=\"19\" cy=\"12\" r=\"1\"></circle><circle cx=\"5\" cy=\"12\" r=\"1\"></circle>",
 "download": "<path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><polyline points=\"7 10 12 15 17 10\"></polyline><line x1=\"12\" x2=\"12\" y1=\"15\" y2=\"3\"></line>",
 "upscale": "<polyline points=\"15 3 21 3 21 9\"></polyline><polyline points=\"9 21 3 21 3 15\"></polyline><line x1=\"21\" x2=\"14\" y1=\"3\" y2=\"10\"></line><line x1=\"3\" x2=\"10\" y1=\"21\" y2=\"14\"></line>",
 "edit": "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path>",
 "film": "<path d=\"M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z\"></path><path d=\"m6.2 5.3 3.1 3.9\"></path><path d=\"m12.4 3.4 3.1 4\"></path><path d=\"M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z\"></path>",
 "copy": "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"></rect><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"></path>",
 "again": "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path>",
 "check": "<path d=\"M20 6 9 17l-5-5\"></path>",
 "plus": "<path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path>",
 "ratio": "<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"></rect>",
 "trash": "<path d=\"M3 6h18\"></path><path d=\"M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6\"></path><path d=\"M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2\"></path><line x1=\"10\" x2=\"10\" y1=\"11\" y2=\"17\"></line><line x1=\"14\" x2=\"14\" y1=\"11\" y2=\"17\"></line>",
 "eraser": "<path d=\"m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21\"></path><path d=\"M22 21H7\"></path><path d=\"m5 11 9 9\"></path>",
 "variations": "<line x1=\"15\" x2=\"15\" y1=\"12\" y2=\"18\"></line><line x1=\"12\" x2=\"18\" y1=\"15\" y2=\"15\"></line><rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"></rect><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"></path>",
 "face": "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"></path><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"></path><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"></path><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"></path><path d=\"M8 14s1.5 2 4 2 4-2 4-2\"></path><path d=\"M9 9h.01\"></path><path d=\"M15 9h.01\"></path>",
 "timer": "<line x1=\"10\" x2=\"14\" y1=\"2\" y2=\"2\"></line><line x1=\"12\" x2=\"15\" y1=\"14\" y2=\"11\"></line><circle cx=\"12\" cy=\"14\" r=\"8\"></circle>",
 "monitor": "<rect width=\"20\" height=\"14\" x=\"2\" y=\"3\" rx=\"2\"></rect><line x1=\"8\" x2=\"16\" y1=\"21\" y2=\"21\"></line><line x1=\"12\" x2=\"12\" y1=\"17\" y2=\"21\"></line>",
 "logout": "<path d=\"M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4\"></path><polyline points=\"16 17 21 12 16 7\"></polyline><line x1=\"21\" x2=\"9\" y1=\"12\" y2=\"12\"></line>",
 "mail": "<rect width=\"20\" height=\"16\" x=\"2\" y=\"4\" rx=\"2\"></rect><path d=\"m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7\"></path>",
 "alert": "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><line x1=\"12\" x2=\"12\" y1=\"8\" y2=\"12\"></line><line x1=\"12\" x2=\"12.01\" y1=\"16\" y2=\"16\"></line>",
 "refresh": "<path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\"></path><path d=\"M21 3v5h-5\"></path><path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\"></path><path d=\"M8 16H3v5\"></path>",
 "brush": "<path d=\"m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08\"></path><path d=\"M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z\"></path>",
 "undo": "<path d=\"M9 14 4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"></path>",
 "route": "<circle cx=\"6\" cy=\"19\" r=\"3\"></circle><path d=\"M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15\"></path><circle cx=\"18\" cy=\"5\" r=\"3\"></circle>"
};
export default function Icon({ name, size = 20, style }) {
  if (name === "play") return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, ...style }}><path d="M8 5.2v13.6l11-6.8z" fill="currentColor" stroke="none" /></svg>;
  return <svg className="ic" viewBox="0 0 24 24" aria-hidden="true" style={{ width: size, height: size, ...style }} dangerouslySetInnerHTML={{ __html: P[name] || "" }} />;
}
