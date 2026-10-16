"use client";
import { EFFECTS, EFFECT_COST } from "../lib/effects";

// Pulse Effects: pick a photo, tap an effect, Pulse. Previews are live CSS loops on the user's own photo
// (or a gradient placeholder before a photo is chosen). No prompt needed.
export default function EffectsGallery({ photo, selected, onSelect, onUpload, onPickRecent, recent = [], uploading, isAdmin }) {
  return (
    <section className="fx">
      <div className="fx-src">
        {photo ? (
          <div className="fx-photo"><img src={photo.url} alt="Your photo" /><button className="fx-swap" onClick={() => onPickRecent(null)}>Change</button></div>
        ) : (
          <label className={`fx-drop${uploading ? " busy" : ""}`}>
            <b>{uploading ? "…" : "⇪"}</b><span>{uploading ? "Uploading…" : "Add a photo"}</span><small>A clear face or subject works best</small>
            <input type="file" accept="image/*,.heic,.heif" hidden disabled={uploading} onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ""; }} />
          </label>
        )}
        {!photo && recent.length > 0 && (
          <div className="fx-recent">{recent.slice(0, 8).map((r) => <button key={r.id} onClick={() => onPickRecent(r)} aria-label="Use this photo"><img src={r.url} alt="" /></button>)}</div>
        )}
      </div>
      <div className="fx-head"><h2>Pulse Effects</h2><small>{isAdmin ? "∞" : `${EFFECT_COST}⚡`} each · 5s vertical clip · paid credits</small></div>
      <div className="fx-grid">
        {EFFECTS.map((e) => (
          <button key={e.id} className={`fx-card${selected === e.id ? " on" : ""}`} onClick={() => onSelect(e.id)} aria-pressed={selected === e.id}>
            <span className={`fx-prev fx-${e.fx}`} style={{ "--a": e.c[0], "--b": e.c[1] }}>
              {photo ? <img src={photo.url} alt="" /> : <i>{e.icon}</i>}
              <em className="fx-over" />
            </span>
            <b>{e.icon} {e.name}</b><small>{e.blurb}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export const FX_CSS = `
.fx{max-width:560px;margin:4px auto 0}
.fx-src{margin-bottom:14px}
.fx-drop{display:flex;flex-direction:column;align-items:center;gap:4px;padding:22px;border:1.5px dashed rgba(236,72,153,.5);border-radius:22px;background:linear-gradient(135deg,rgba(147,51,234,.12),rgba(236,72,153,.06));cursor:pointer;text-align:center}
.fx-drop b{font-size:26px}.fx-drop span{font-weight:800;font-size:16px}.fx-drop small{color:var(--mut);font-size:12.5px}.fx-drop.busy{opacity:.6}
.fx-photo{position:relative;width:104px;margin:0 auto;aspect-ratio:9/16;border-radius:18px;overflow:hidden;border:1px solid rgba(236,72,153,.5)}
.fx-photo img{width:100%;height:100%;object-fit:cover}
.fx-swap{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);padding:5px 12px;border-radius:999px;border:0;background:rgba(0,0,0,.65);color:#fff;font-size:12px;font-weight:700}
.fx-recent{display:flex;gap:8px;overflow-x:auto;margin-top:10px;padding-bottom:2px}
.fx-recent button{flex:0 0 56px;height:56px;border-radius:12px;overflow:hidden;border:1px solid var(--line);padding:0;background:#111}
.fx-recent img{width:100%;height:100%;object-fit:cover}
.fx-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:4px 2px 10px}
.fx-head h2{margin:0;font-size:17px;white-space:nowrap}.fx-head small{color:var(--mut);font-size:11.5px;text-align:right}
.fx-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.fx-card{display:flex;flex-direction:column;gap:3px;padding:0 0 8px;border-radius:16px;border:1px solid var(--line);background:#111119;color:var(--txt);text-align:left;overflow:hidden}
.fx-card b{font-size:12.5px;padding:0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fx-card small{font-size:10.5px;color:var(--mut);padding:0 8px;line-height:1.25}
.fx-card.on{border-color:var(--p);box-shadow:0 0 0 2px rgba(236,72,153,.35)}
.fx-prev{position:relative;display:grid;place-items:center;aspect-ratio:9/13;overflow:hidden;background:radial-gradient(circle at 50% 35%,var(--a),var(--b));margin-bottom:5px}
.fx-prev i{font-style:normal;font-size:34px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.4))}
.fx-prev img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.fx-prev i,.fx-prev img{animation:fxBase 2.6s ease-in-out infinite}
.fx-over{position:absolute;inset:0;pointer-events:none}
.fx-rise i,.fx-rise img{animation-name:fxRise}.fx-rise .fx-over{background:linear-gradient(0deg,rgba(245,158,11,.55),transparent 60%);animation:fxGlow 2.6s infinite}
.fx-dust i,.fx-dust img{animation-name:fxDust}.fx-dust .fx-over{background-image:radial-gradient(#fff 1px,transparent 1.5px);background-size:9px 9px;animation:fxDrift 2.6s infinite}
.fx-shift i,.fx-shift img{animation-name:fxShift}
.fx-dance i,.fx-dance img{animation:fxDance .9s ease-in-out infinite}
.fx-zoomout i,.fx-zoomout img{animation-name:fxZoom}.fx-zoomout .fx-over{background:radial-gradient(circle,transparent 30%,#020617 75%);animation:fxGlow 2.6s infinite}
.fx-melt i,.fx-melt img{animation-name:fxMelt;transform-origin:50% 100%}
.fx-stone i,.fx-stone img{animation-name:fxStone}
.fx-inflate i,.fx-inflate img{animation-name:fxInflate}
.fx-flame .fx-over{background:linear-gradient(0deg,rgba(239,68,68,.75),rgba(245,158,11,.25) 45%,transparent 70%);animation:fxFlick .5s infinite alternate}
.fx-scan .fx-over{background:linear-gradient(180deg,transparent 45%,rgba(34,211,238,.8) 50%,transparent 55%);background-size:100% 200%;animation:fxScan 2s linear infinite}
.fx-shine i,.fx-shine img{animation-name:fxGold}.fx-shine .fx-over{background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.6) 50%,transparent 65%);background-size:250% 100%;animation:fxSheen 2s infinite}
.fx-hop i,.fx-hop img{animation:fxHop 1.1s ease-in-out infinite}
@keyframes fxBase{50%{transform:scale(1.05)}}
@keyframes fxRise{0%,20%{transform:translateY(0) scale(1)}70%,100%{transform:translateY(-14%) scale(1.06)}}
@keyframes fxDust{0%,25%{opacity:1;filter:none}80%,100%{opacity:.1;filter:blur(3px)}}
@keyframes fxDrift{from{background-position:0 0;opacity:0}50%{opacity:1}to{background-position:20px -30px;opacity:0}}
@keyframes fxShift{0%,30%{filter:none}60%,100%{filter:saturate(2) contrast(1.3) hue-rotate(-25deg)}}
@keyframes fxDance{0%,100%{transform:rotate(-6deg) translateY(0)}50%{transform:rotate(6deg) translateY(-5%)}}
@keyframes fxZoom{0%,15%{transform:scale(1.25)}100%{transform:scale(.35)}}
@keyframes fxMelt{0%,20%{transform:scaleY(1) skewX(0)}80%,100%{transform:scaleY(.55) scaleX(1.2) skewX(6deg);filter:blur(1px)}}
@keyframes fxStone{0%,25%{filter:none}70%,100%{filter:grayscale(1) contrast(1.4) brightness(1.15)}}
@keyframes fxInflate{0%,15%{transform:scale(1)}70%{transform:scale(1.35,1.25)}100%{transform:scale(1.3) translateY(-10%)}}
@keyframes fxGlow{0%,100%{opacity:.3}50%{opacity:1}}
@keyframes fxFlick{to{opacity:.55}}
@keyframes fxScan{from{background-position:0 100%}to{background-position:0 -100%}}
@keyframes fxGold{0%,25%{filter:none}70%,100%{filter:sepia(1) saturate(3.5) hue-rotate(-12deg) brightness(1.1)}}
@keyframes fxSheen{from{background-position:120% 0}to{background-position:-120% 0}}
@keyframes fxHop{0%,100%{transform:translateY(0)}40%{transform:translateY(-9%)}}
@media (prefers-reduced-motion:reduce){.fx-prev *{animation:none!important}}
`;
