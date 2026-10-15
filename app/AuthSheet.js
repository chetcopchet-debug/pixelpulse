"use client";
import { useEffect, useState } from "react";

export default function AuthSheet({ reason, onClose, onSignedIn }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [google, setGoogle] = useState(false);
  useEffect(() => { fetch("/api/auth/providers").then((r) => r.json()).then((d) => setGoogle(!!d.google)).catch(() => {}); }, []);
  // Same-browser link flow: the link opens in a new tab and signs in this browser; notice it here.
  useEffect(() => {
    if (step !== "code") return;
    let stop = false;
    const check = () => fetch("/api/credits", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!stop && d.account) onSignedIn(d); }).catch(() => {});
    const t = setInterval(() => { if (document.visibilityState === "visible") check(); }, 4000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [step, onSignedIn]);
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
      <form className="as-sheet" onClick={(e) => e.stopPropagation()} onSubmit={step === "email" ? send : (e) => { e.preventDefault(); if (showCode) verify(e); }}>
        <div className="as-grab" />
        <div className="as-dot"><i /></div>
        <h3>{step === "email" ? "Sign in to PixelPulse" : "Check your inbox"}</h3>
        {step === "email" ? <>
          <p className="as-sub">{reason || "Keep your credits and gallery safe, on every device. No password."}</p>
          {google && <>
            <a className="as-google" href="/api/auth/google"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</a>
            <div className="as-or"><span>or use email</span></div>
          </>}
          <input className="as-in" type="email" inputMode="email" autoComplete="email" autoFocus placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={`as-go${google ? " as-go2" : ""}`} disabled={busy || !email.includes("@")}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
        </> : <>
          <div className="as-mail">✉</div>
          <p className="as-sub">We sent a sign-in link to <b>{email}</b>.<br />Open the email and <b>tap the link</b> — you'll be signed in automatically.</p>
          <p className="as-sub as-small">If the link opens in another app or browser, you'll be signed in there. Use the same browser to keep this device's pulses.</p>
          {!showCode ? <button type="button" className="as-link" onClick={() => setShowCode(true)}>Have a code?</button> : <>
            <input className="as-in as-code" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} placeholder="••••••" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
            <button className="as-go" disabled={busy || code.length < 6}>{busy ? "Checking…" : "Sign in with code"}</button>
          </>}
          <p className="as-sub as-small"><button type="button" className="as-link" onClick={send} disabled={busy}>Resend email</button> · <button type="button" className="as-link" onClick={() => { setStep("email"); setErr(""); setShowCode(false); }}>Change email</button></p>
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
.as-mail{font-size:34px;margin:2px 0 6px;animation:asPulse 1.6s ease-in-out infinite}
@keyframes asPulse{50%{transform:scale(1.12)}}
.as-google{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;padding:14px;border-radius:999px;background:#fff;color:#1f1f1f;font-weight:700;font-size:15px;text-decoration:none}
.as-or{display:flex;align-items:center;gap:10px;margin:14px 0 10px;color:#7c7c94;font-size:12px}.as-or::before,.as-or::after{content:'';flex:1;height:1px;background:#2a2a40}
.as-go2{background:#1c1c2a;border:1px solid #33334a}
.as-err{color:#fda4af;font-size:13px;margin:10px 0 0}
.as-fine{font-size:11px;color:#7c7c94;margin:14px 0 0}
`}</style>
    </div>
  );
}
