"use client";
import { useEffect, useRef, useState } from "react";

// Cinematic landing hero: full-bleed looping video / stills that swap with rotating example prompts.
const SLIDES = [
  { kind: "video", src: "/hero/samurai", poster: "/hero/samurai-poster.jpg", prompt: "Samurai with a katana, neon Tokyo rain", mode: "video", tag: "Video" },
  { kind: "img", src: "/hero/katana.webp", prompt: "Cyber samurai, glowing blade, rain-soaked alley", mode: "image", tag: "Image" },
  { kind: "img", src: "/hero/astronaut.webp", prompt: "Astronaut with a lightsaber, cinematic rim light", mode: "image", tag: "Edit" },
  { kind: "img", src: "/hero/neon.webp", prompt: "Lone figure on a neon beach under a synthwave sun", mode: "image", tag: "Image" },
  { kind: "img", src: "/hero/sneaker.webp", prompt: "Holographic sneaker bursting through a wooden table", mode: "image", tag: "Image" },
];

export default function Hero({ onTry }) {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState("");
  const [calm, setCalm] = useState(false);
  const vref = useRef(null);
  useEffect(() => { setCalm(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false); }, []);
  useEffect(() => { if (calm) return; const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 5200); return () => clearInterval(t); }, [calm]);
  useEffect(() => {
    const full = SLIDES[i].prompt; if (calm) { setTyped(full); return; }
    let k = 0; setTyped(""); const t = setInterval(() => { k += 1; setTyped(full.slice(0, k)); if (k >= full.length) clearInterval(t); }, 32);
    return () => clearInterval(t);
  }, [i, calm]);
  useEffect(() => { const v = vref.current; if (!v || calm) return; if (i === 0) { v.currentTime = 0; v.play().catch(() => {}); } }, [i, calm]);
  const s = SLIDES[i];
  return (
    <section className="hx" aria-label="PixelPulse showcase">
      <div className="hx-media" aria-hidden="true">
        {SLIDES.map((sl, n) => sl.kind === "video" ? (
          <video key={n} ref={vref} className={`hx-layer${n === i ? " on" : ""}`} muted loop playsInline autoPlay={!calm} preload="metadata" poster={sl.poster}>
            <source src={`${sl.src}.webm`} type="video/webm" /><source src={`${sl.src}.mp4`} type="video/mp4" />
          </video>
        ) : (
          <img key={n} className={`hx-layer hx-kb${n === i ? " on" : ""}`} src={sl.src} alt="" loading={n === 1 ? "eager" : "lazy"} decoding="async" />
        ))}
        <i className="hx-shade" /><i className="hx-ring" /><i className="hx-ring hx-ring2" />
      </div>
      <div className="hx-copy">
        <span className="hx-kicker"><b className="hx-dot" />AI images · video · effects</span>
        <h2 className="hx-h"><span>Type it.</span> <span>See it.</span> <em>Pulse it.</em></h2>
        <button className="hx-prompt" onClick={() => onTry(s)} aria-label={`Try: ${s.prompt}`}>
          <small>{s.tag}</small><span>{typed}<i className="hx-caret" /></span><b>Try ↗</b>
        </button>
        <div className="hx-dots">{SLIDES.map((_, n) => <button key={n} className={n === i ? "on" : ""} onClick={() => setI(n)} aria-label={`Example ${n + 1}`} />)}</div>
      </div>
    </section>
  );
}

export const HERO_CSS = `
.hx{position:relative;margin:-4px -14px 18px;height:min(66vh,560px);min-height:430px;overflow:hidden;border-radius:0 0 30px 30px;isolation:isolate;animation:hxIn .7s ease-out both}
.hx-media{position:absolute;inset:0;background:#0b0614 url(/hero/samurai-poster.jpg) center/cover}
.hx-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1s ease}
.hx-layer.on{opacity:1}
.hx-kb.on{animation:hxKb 6s ease-out both}
.hx-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(7,7,10,.15) 0%,rgba(7,7,10,0) 35%,rgba(7,7,10,.55) 62%,#07070a 100%),radial-gradient(120% 60% at 50% 110%,rgba(147,51,234,.45),transparent 60%)}
.hx-ring{position:absolute;left:50%;top:38%;width:220px;height:220px;margin:-110px;border-radius:50%;border:1px solid rgba(236,72,153,.35);animation:hxRing 3.2s ease-out infinite;pointer-events:none}
.hx-ring2{animation-delay:1.6s}
.hx-copy{position:absolute;left:0;right:0;bottom:0;padding:0 18px 18px;display:flex;flex-direction:column;gap:12px}
.hx-kicker{align-self:flex-start;display:flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;font-size:11.5px;font-weight:700;letter-spacing:.3px;background:rgba(10,10,18,.55);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(10px);animation:hxUp .6s .15s both}
.hx-dot{width:7px;height:7px;border-radius:50%;background:var(--p);box-shadow:0 0 0 0 rgba(236,72,153,.7);animation:hxBeat 1.6s infinite}
.hx-h{margin:0;font-size:clamp(34px,10.5vw,54px);line-height:1.02;font-weight:900;letter-spacing:-1.5px;color:#fff;text-shadow:0 4px 30px rgba(0,0,0,.5)}
.hx-h span{display:inline-block;animation:hxUp .7s both}.hx-h span:nth-child(2){animation-delay:.12s}
.hx-h em{display:inline-block;font-style:normal;background:linear-gradient(90deg,#c084fc,#ec4899,#fb923c,#c084fc);background-size:300% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:hxUp .7s .24s both,hxGrad 6s linear infinite}
.hx-prompt{display:flex;align-items:center;gap:10px;width:100%;padding:12px 12px 12px 14px;border-radius:20px;border:1px solid rgba(236,72,153,.45);background:rgba(12,10,22,.62);backdrop-filter:blur(16px);color:#fff;text-align:left;box-shadow:0 10px 40px rgba(147,51,234,.25);animation:hxUp .7s .35s both;transition:transform .15s}
.hx-prompt:active{transform:scale(.98)}
.hx-prompt small{flex:none;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;padding:4px 8px;border-radius:8px;background:rgba(168,85,247,.25);color:#f0abfc}
.hx-prompt span{flex:1;min-width:0;font-size:15px;line-height:1.3;min-height:2.6em;display:flex;align-items:center}
.hx-prompt b{flex:none;font-size:13px;padding:8px 12px;border-radius:12px;background:linear-gradient(90deg,var(--v),var(--p))}
.hx-caret{display:inline-block;width:2px;height:1.05em;margin-left:2px;background:#f0abfc;animation:hxBlink 1s steps(1) infinite}
.hx-dots{display:flex;gap:6px;justify-content:center}
.hx-dots button{width:7px;height:7px;padding:0;border:0;border-radius:9px;background:rgba(255,255,255,.3);transition:width .3s,background .3s}
.hx-dots button.on{width:22px;background:linear-gradient(90deg,var(--v),var(--p))}
@keyframes hxIn{from{opacity:0}to{opacity:1}}
@keyframes hxUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes hxKb{from{transform:scale(1.12)}to{transform:scale(1)}}
@keyframes hxRing{from{transform:scale(.4);opacity:.9}to{transform:scale(2.4);opacity:0}}
@keyframes hxBeat{70%{box-shadow:0 0 0 9px rgba(236,72,153,0)}100%{box-shadow:0 0 0 0 rgba(236,72,153,0)}}
@keyframes hxGrad{to{background-position:300% 0}}
@keyframes hxBlink{50%{opacity:0}}
@media (min-width:821px){.hx{margin:0 auto 18px;max-width:1100px;border-radius:30px}}
@media (prefers-reduced-motion:reduce){.hx *,.hx{animation:none!important;transition:none!important}}
`;
