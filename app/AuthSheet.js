"use client";
import { useState } from "react";

export default function AuthSheet({ reason, onClose, onSignedIn }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };
  const send = async (e) => {
    e?.preventDefault(); if (busy) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/start", { email });
    setBusy(false); if (ok) { setStep("code"); setCode(""); } else setErr(d.error || "Could not send the code.");
  };
  const verify = async (e) => {
    e?.preventDefault(); if (busy) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/verify", { email, code });
    setBusy(false); if (ok) onSignedIn(d); else setErr(d.error || "That code didn't work.");
  };
  return (
    <div className="as-scrim" onClick={onClose} role="dialog" aria-modal="true" aria-label="Sign in">
      <form className="as-sheet" onClick={(e) => e.stopPropagation()} onSubmit={step === "email" ? send : verify}>
        <div className="as-grab" />
        <div className="as-dot"><i /></div>
        <h3>{step === "email" ? "Sign in to PixelPulse" : "Check your email"}</h3>
        {step === "email" ? <>
          <p className="as-sub">{reason || "Keep your credits and gallery safe, on every device. No password."}</p>
          <input className="as-in" type="email" inputMode="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="as-go" disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a code"}</button>
        </> : <>
          <p className="as-sub">We sent a code to <b>{email}</b>. Enter it below, or tap the link in the email.</p>
          <input className="as-in as-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className="as-go" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in"}</button>
          <p className="as-sub as-small"><button type="button" className="as-link" onClick={send} disabled={busy}>Send a new code</button> · <button type="button" className="as-link" onClick={() => { setStep("email"); setErr(""); }}>Change email</button></p>
        </>}
        {err && <p className="as-err">{err}</p>}
        <p className="as-fine">Your current gallery and credits on this device move into your account.</p>
      </form>
      <style>{`
.as-scrim{position:fixed;inset:0;z-index:85;background:rgba(5,5,9,.72);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center}
.as-sheet{width:100%;max-width:440px;background:linear-gradient(180deg,#171724,#0d0d15);border:1px solid #2a2a40;border-bottom:0;border-radius:28px 28px 0 0;padding:10px 20px calc(20px + env(safe-area-inset-bottom));color:#f4f4f8;text-align:center;animation:asUp .25s ease}
@media(min-width:700px){.as-scrim{align-items:center}.as-sheet{border-radius:28px;border-bottom:1px solid #2a2a40}}
@keyframes asUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
.as-grab{width:40px;height:4px;border-radius:9px;background:#3a3a52;margin:0 auto 12px}
.as-dot{width:46px;height:46px;margin:0 auto 8px;border-radius:50%;background:linear-gradient(135deg,#9333ea,#ec4899);display:grid;place-items:center;box-shadow:0 0 22px rgba(236,72,153,.45)}
.as-dot i{width:13px;height:13px;border-radius:50%;background:#fff}
.as-sheet h3{margin:4px 0 6px;font-size:20px}
.as-sub{color:#b4b4c8;font-size:14px;line-height:1.5;margin:0 0 14px}.as-sub b{color:#f0abfc}
.as-small{font-size:12.5px;margin:10px 0 0}
.as-in{width:100%;box-sizing:border-box;padding:14px 16px;border-radius:16px;border:1px solid #2a2a40;background:#0e0e16;color:#fff;font-size:16px;outline:none}
.as-in:focus{border-color:rgba(236,72,153,.7)}
.as-code{text-align:center;letter-spacing:.5em;font-size:24px;font-weight:700}
.as-go{width:100%;margin-top:10px;padding:14px;border-radius:999px;border:0;font-weight:800;font-size:15px;color:#fff;background:linear-gradient(90deg,#9333ea,#ec4899)}
.as-go:disabled{opacity:.5}
.as-link{background:none;border:0;color:#d8b4fe;text-decoration:underline;font-size:12.5px;padding:0}
.as-err{color:#fda4af;font-size:13px;margin:10px 0 0}
.as-fine{font-size:11px;color:#7c7c94;margin:14px 0 0}
`}</style>
    </div>
  );
}
