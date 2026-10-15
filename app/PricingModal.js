"use client";
import { useEffect, useState } from "react";

const FALLBACK = [
  { id: "pack", name: "Creator Pack", credits: 500, price: "$9.90", period: "one-time", enabled: false },
  { id: "pro", name: "Pulse Pro", credits: 1200, price: "$14.90", period: "month", enabled: false },
];

// need: { label, cost } | null (opened from the profile menu)
export default function PricingModal({ need, credits, paid, resetIn, plans, onClose, signedIn = true, onSignIn }) {
  const list = plans?.length ? plans : FALLBACK;
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { const k = (e) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const buy = async (id) => {
    setBusy(id); setErr("");
    try {
      const r = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plan: id }) });
      const d = await r.json().catch(() => ({}));
      if (d.url) { window.location.href = d.url; return; }
      setErr(d.disabled ? "Payments are coming soon." : d.error || "Checkout is unavailable right now.");
    } catch { setErr("Checkout is unavailable right now."); }
    setBusy("");
  };
  return (
    <div className="pm-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Get more credits">
      <div className="pm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="pm-grab" />
        <div className="pm-pulse"><i /><i /><b>⚡</b></div>
        <h3>{need ? "Keep the pulse going" : "Get more credits"}</h3>
        <p className="pm-sub">
          {need ? <>{need.label} needs <b>{need.cost}⚡</b> — you have <b>{credits + paid}⚡</b>.</> : <>You have <b>{credits}⚡</b> free today{paid ? <> + <b>{paid}⚡</b> paid</> : null}.</>}
          <br />Your 10 free credits refill in <b>{resetIn}</b>.
        </p>
        <div className="pm-plans">
          {list.map((p) => (
            <div key={p.id} className={`pm-plan${p.id === "pro" ? " pm-hot" : ""}`}>
              {p.id === "pro" && <span className="pm-tag">Best value</span>}
              <b className="pm-name">{p.name}</b>
              <div className="pm-price">{p.price}<small>{p.period === "month" ? " / month" : " once"}</small></div>
              <div className="pm-cr">{p.credits.toLocaleString()}⚡{p.period === "month" ? " every month" : " · never expire"}</div>
              <button className="pm-buy" disabled={!p.enabled || !!busy} onClick={() => buy(p.id)}>
                {!p.enabled ? "Coming soon" : busy === p.id ? "Opening…" : p.period === "month" ? "Go Pro" : "Get the pack"}
              </button>
            </div>
          ))}
        </div>
        {err && <p className="pm-err">{err}</p>}
        {!signedIn && onSignIn && <p className="pm-fine" style={{ margin: "12px 0 0" }}><button className="pm-link" onClick={onSignIn}>✉ Sign in</button> to keep your credits safe on every device.</p>}
        <p className="pm-fine">Free credits are used first. Secure checkout by Lemon Squeezy · cancel Pro anytime.</p>
        <button className="pm-close" onClick={onClose}>{need ? "Wait for free credits" : "Close"}</button>
      </div>
      <style>{`
.pm-scrim{position:fixed;inset:0;z-index:80;background:rgba(5,5,9,.72);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:ppFade .2s}
.pm-sheet{width:100%;max-width:520px;background:linear-gradient(180deg,#171724,#0d0d15);border:1px solid #2a2a40;border-bottom:0;border-radius:28px 28px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));color:#f4f4f8;text-align:center;animation:pmUp .28s cubic-bezier(.2,.9,.3,1)}
@media(min-width:700px){.pm-scrim{align-items:center}.pm-sheet{border-radius:28px;border-bottom:1px solid #2a2a40}}
@keyframes pmUp{from{transform:translateY(40px);opacity:0}to{transform:none;opacity:1}}
.pm-grab{width:40px;height:4px;border-radius:9px;background:#3a3a52;margin:0 auto 10px}
.pm-pulse{position:relative;width:56px;height:56px;margin:4px auto 6px;display:grid;place-items:center}
.pm-pulse b{position:relative;z-index:1;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#9333ea,#ec4899);font-size:20px}
.pm-pulse i{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(236,72,153,.5);animation:pmRing 2s ease-out infinite}
.pm-pulse i+i{animation-delay:1s}
@keyframes pmRing{from{transform:scale(.7);opacity:1}to{transform:scale(1.5);opacity:0}}
.pm-sheet h3{margin:4px 0 6px;font-size:20px}
.pm-sub{margin:0 0 14px;color:#b4b4c8;font-size:14px;line-height:1.5}
.pm-sub b{color:#f0abfc}
.pm-plans{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pm-plan{position:relative;padding:16px 10px 12px;border-radius:20px;background:#12121c;border:1px solid #2a2a40;display:flex;flex-direction:column;gap:4px;align-items:center}
.pm-hot{border-color:rgba(236,72,153,.7);box-shadow:0 0 0 1px rgba(236,72,153,.25),0 10px 30px rgba(147,51,234,.25)}
.pm-tag{position:absolute;top:-9px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:800;letter-spacing:.04em;padding:3px 9px;border-radius:99px;background:linear-gradient(90deg,#9333ea,#ec4899);white-space:nowrap}
.pm-name{font-size:14px}
.pm-price{font-size:22px;font-weight:800}
.pm-price small{font-size:11px;font-weight:600;color:#a1a1b5}
.pm-cr{font-size:12px;color:#d8b4fe;min-height:30px}
.pm-buy{margin-top:4px;width:100%;padding:10px 6px;border-radius:999px;border:0;font-weight:800;font-size:13px;color:#fff;background:linear-gradient(90deg,#9333ea,#ec4899);cursor:pointer}
.pm-buy:disabled{background:#232334;color:#8a8aa3;cursor:default}
.pm-err{color:#fda4af;font-size:13px;margin:10px 0 0}
.pm-fine{font-size:11px;color:#7c7c94;margin:12px 0 8px}
.pm-link{background:none;border:0;padding:0;color:#f0abfc;font-weight:700;text-decoration:underline;font-size:inherit}
.pm-close{width:100%;padding:12px;border-radius:999px;border:1px solid #2a2a40;background:transparent;color:#d4d4e0;font-weight:700}
`}</style>
    </div>
  );
}
