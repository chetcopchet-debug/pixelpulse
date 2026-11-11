"use client";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { imageModels, videoModels, videoModel, videoPlan, videoOptionCost, IMAGE_RATIOS, TOOLS } from "./models";
import { FREE_DAILY } from "./store";

export function Sheet({ title, sub, onClose, children }) {
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-h"><h2 className="d">{title}</h2><button className="ib" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
        {sub ? <p className="sm t2" style={{ padding: "2px 20px 6px" }}>{sub}</p> : null}
        <div className="sheet-b">{children}</div>
      </div>
    </div>
  );
}

export function ModelSheet({ s, onClose }) {
  const video = s.mode === "video";
  const [sort, setSort] = useState("best");
  const all = video ? videoModels : imageModels;
  const list = sort === "price" ? [...all].sort((a, b) => a.cost - b.cost) : all;
  const current = video ? s.vidModel : s.imgModel;
  return (
    <Sheet title={video ? "Video models" : "Image models"} sub={video ? "Prices are for the shortest clip. Longer or sharper clips cost more." : "The price is for one image."} onClose={onClose}>
      <div className="r" style={{ gap: 6, padding: "0 8px 8px" }}>
        <button className={`chip${sort === "best" ? " on" : ""}`} onClick={() => setSort("best")}>Recommended</button>
        <button className={`chip${sort === "price" ? " on" : ""}`} onClick={() => setSort("price")}>Lowest price</button>
      </div>
      {list.map((m) => (
        <button key={m.id} className={`mrow${m.id === current ? " on" : ""}`} aria-pressed={m.id === current} onClick={() => { (video ? s.setVidModel : s.setImgModel)(m.id); onClose(); }}>
          <span className="grow">
            <span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span>
            <span className="sm t2" style={{ display: "block" }}>{m.desc}</span>
          </span>
          {m.id === current ? <span className="tick"><Icon name="check" size={14} /></span> : null}
          <Price n={m.cost} />
        </button>
      ))}
    </Sheet>
  );
}

export function RatioSheet({ s, onClose }) {
  const box = { "1:1": [18, 18], "9:16": [12, 20], "16:9": [22, 13] };
  return (
    <Sheet title="Shape" onClose={onClose}>
      <div className="opt" style={{ padding: "4px 8px 8px" }}>
        {IMAGE_RATIOS.map((r) => (
          <button key={r.id} className={r.id === s.ratio ? "on" : ""} aria-pressed={r.id === s.ratio} onClick={() => { s.setRatio(r.id); onClose(); }} style={{ flex: "1 1 0", alignItems: "center", gap: 8, minHeight: 92 }}>
            <i style={{ display: "block", width: box[r.id][0], height: box[r.id][1], borderRadius: 3, boxShadow: "inset 0 0 0 2px currentColor" }} />
            <span>{r.label}<span className="sm" style={{ display: "block", opacity: 0.7, textAlign: "center" }}>{r.id}</span></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function VideoSheet({ s, onClose }) {
  const m = videoModel(s.vidModel);
  const plan = videoPlan(m.id, s.vDur, s.vRes, s.ratio);
  const Group = ({ label, children }) => <div style={{ padding: "8px 8px 12px" }}><p className="sm b t2" style={{ marginBottom: 8 }}>{label}</p><div className="opt">{children}</div></div>;
  return (
    <Sheet title="Video settings" sub={`${m.name}. The price changes with length and quality.`} onClose={onClose}>
      <Group label="Length">
        {plan.durations.map((d) => {
          const c = videoOptionCost(m.id, d, plan.r);
          return <button key={d} className={d === plan.d ? "on" : ""} aria-pressed={d === plan.d} disabled={c === null} onClick={() => s.setVDur(d)}><span>{d} seconds</span>{c !== null ? <Price n={c} /> : <span className="sm">Not at {plan.r}</span>}</button>;
        })}
      </Group>
      <Group label="Quality">
        {plan.resolutions.map((r) => {
          const c = videoOptionCost(m.id, plan.d, r);
          return <button key={r} className={r === plan.r ? "on" : ""} aria-pressed={r === plan.r} disabled={c === null} onClick={() => s.setVRes(r)}><span>{r}</span>{c !== null ? <Price n={c} /> : <span className="sm">Not at {plan.d} s</span>}</button>;
        })}
      </Group>
      <Group label="Shape">
        {plan.ratios.map((r) => <button key={r} className={r === plan.ratio ? "on" : ""} aria-pressed={r === plan.ratio} onClick={() => s.setRatio(r)}><span>{r}</span></button>)}
      </Group>
      <div style={{ padding: "4px 8px 0" }}><button className="btn btn-p btn-wide btn-split" onClick={onClose}><span>Done</span><Price n={plan.cost} /></button></div>
    </Sheet>
  );
}

export function PricingSheet({ s, need, label, paidOnly, onClose }) {
  const w = s.wallet;
  const [busy, setBusy] = useState("");
  const plans = (w.plans || []).filter((p) => p.credits);
  const open = plans.some((p) => p.enabled);
  const sub = need
    ? `${label || "This"} costs ${need} credits.${paidOnly ? " Video and a few tools use bought credits only; free credits don't cover them." : ` You have ${w.free} free and ${w.paid} bought; one generation is paid from one of them, not a mix.`}`
    : "Credits work on every model. Bought credits are used after your free ones.";
  return (
    <Sheet title="Add credits" sub={sub} onClose={onClose}>
      <div className="c" style={{ gap: 8, padding: "4px 8px" }}>
        {plans.map((p) => (
          <div key={p.id} className="plan">
            <div className="grow">
              <p className="b" style={{ fontSize: 16 }}>{p.name}</p>
              <p className="sm t2 r" style={{ gap: 6 }}><i className="coin" />{Number(p.credits).toLocaleString("en-US")} credits, {p.period === "month" ? "every month" : "one payment"}</p>
            </div>
            <button className="btn btn-p" disabled={!p.enabled || Boolean(busy)} onClick={async () => { setBusy(p.id); await s.buy(p.id); setBusy(""); }}>
              {busy === p.id ? <i className="spin" /> : p.price}{p.period === "month" && busy !== p.id ? <span style={{ opacity: 0.7 }}>/mo</span> : null}
            </button>
          </div>
        ))}
        {!open ? <p className="sm t2" style={{ padding: "4px 8px" }}>Payments are opening soon. Until then you can keep creating with free credits.</p> : null}
        {w.guest && !paidOnly ? <button className="btn btn-s btn-wide" onClick={() => s.askSignIn()}>Sign in for {FREE_DAILY} free credits every day</button> : null}
        <a className="btn btn-wide" href="/pricing">See all prices</a>
      </div>
    </Sheet>
  );
}

// Asks for one line of text before running a tool (Edit with words, Keep the face).
export function AskSheet({ s, tool, item, onClose }) {
  const t = TOOLS[tool];
  const [text, setText] = useState("");
  const go = () => { const v = text.trim(); if (!v) return; onClose(); s.runTool(tool, item, tool === "facelock" ? { prompt: v, aspectRatio: IMAGE_RATIOS.some((r) => r.id === item.ratio) ? item.ratio : "1:1" } : { prompt: v }); };
  return (
    <Sheet title={t.ask} sub={tool === "facelock" ? "The face from this photo is kept; everything else follows your description." : "The rest of the image stays as it is. The original is kept in your Library."} onClose={onClose}>
      <div className="c" style={{ gap: 12, padding: "4px 8px" }}>
        <textarea className="field" autoFocus maxLength={1500} value={text} placeholder={t.hint} aria-label={t.ask} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-p btn-wide btn-split" disabled={!text.trim()} onClick={go}><span>{t.label}</span><Price n={t.cost} /></button>
      </div>
    </Sheet>
  );
}

export function SignInSheet({ s, reason, onClose }) {
  const [step, setStep] = useState("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [google, setGoogle] = useState(false);
  const [showCode, setShowCode] = useState(false);
  useEffect(() => { fetch("/api/auth/providers").then((r) => r.json()).then((d) => setGoogle(Boolean(d.google))).catch(() => {}); }, []);
  // The emailed link opens in another tab and signs this browser in; notice it here.
  useEffect(() => {
    if (step !== "code") return;
    let stop = false;
    const check = () => fetch("/api/credits", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (!stop && d.account) s.signedIn(); }).catch(() => {});
    const t = setInterval(() => { if (document.visibilityState === "visible") check(); }, 4000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis);
    return () => { stop = true; clearInterval(t); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [step, s.signedIn]);
  const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };
  const send = async (e) => {
    e?.preventDefault(); if (busy || !email.includes("@")) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/start", { email }).catch(() => ({ ok: false, d: {} }));
    setBusy(false); if (ok) { setStep("code"); setCode(""); } else setErr(d.error || "The email couldn't be sent. Try again.");
  };
  const verify = async (e) => {
    e?.preventDefault(); if (busy || code.length < 6) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/verify", { email, code }).catch(() => ({ ok: false, d: {} }));
    setBusy(false); if (ok) s.signedIn(); else setErr(d.error || "That code didn't work. Check it and try again.");
  };
  return (
    <Sheet title={step === "email" ? "Sign in" : "Check your email"} sub={step === "email" ? reason || `Keep your work on every device and get ${FREE_DAILY} free credits every day. No password.` : null} onClose={onClose}>
      {step === "email" ? (
        <form className="c" style={{ gap: 10, padding: "4px 8px" }} onSubmit={send}>
          {google ? (
            <>
              <a className="btn btn-s btn-wide" href="/api/auth/google">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                Continue with Google
              </a>
              <p className="sm t3" style={{ textAlign: "center" }}>or use your email</p>
            </>
          ) : null}
          <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-p btn-wide" disabled={busy || !email.includes("@")}>{busy ? <i className="spin" /> : "Email me a sign-in link"}</button>
          {err ? <p className="sm" style={{ color: "var(--neg)" }} role="alert">{err}</p> : null}
          <p className="sm t3">What you made on this device moves into your account.</p>
        </form>
      ) : (
        <form className="c" style={{ gap: 10, padding: "4px 8px" }} onSubmit={verify}>
          <p className="t2">We sent a sign-in link to <b style={{ color: "var(--text)" }}>{email}</b>. Open the email and tap the link; this page signs in by itself.</p>
          <p className="sm t3">If the link opens in another browser, you're signed in there instead.</p>
          {showCode ? (
            <>
              <input className="field num" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} placeholder="Code from the email" aria-label="Code from the email" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn btn-p btn-wide" disabled={busy || code.length < 6}>{busy ? <i className="spin" /> : "Sign in with the code"}</button>
            </>
          ) : <button type="button" className="btn btn-s btn-wide" onClick={() => setShowCode(true)}>I have a code instead</button>}
          {err ? <p className="sm" style={{ color: "var(--neg)" }} role="alert">{err}</p> : null}
          <div className="r" style={{ gap: 16 }}>
            <button type="button" className="link sm" style={{ minHeight: 44 }} onClick={send} disabled={busy}>Send it again</button>
            <button type="button" className="link sm" style={{ minHeight: 44 }} onClick={() => { setStep("email"); setErr(""); setShowCode(false); }}>Use another email</button>
          </div>
        </form>
      )}
    </Sheet>
  );
}
