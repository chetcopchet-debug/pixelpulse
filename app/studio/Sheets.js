"use client";
import { t, tn, N, sm, num, LANGS } from "../i18n/index.js";
import { rich } from "../i18n/rich.js";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price } from "./bits";
import Sheet from "./Sheet";
import ImproveBar from "./ImproveBar";
import { ideaCards } from "./ideas";
import { recommend, VIDEO_AUTO_CAP } from "./auto";
import { imageModels, videoModels, videoModel, videoPlan, videoOptionCost, videoTakesImage, comparePlan, MAX_COMPARE, IMAGE_RATIOS, TOOLS, resLabel } from "./models";
import { FREE_DAILY } from "./store";

export function ModelSheet({ s, onClose }) {
  const video = s.mode === "video";
  const [sort, setSort] = useState("best");
  // A model that is down right now stays in the list, marked and not selectable, below the ones that work.
  const every = video ? videoModels : imageModels;
  const sorted = sort === "price" ? [...every].sort((a, b) => a.cost - b.cost) : every;
  const list = [...sorted.filter((m) => !s.off.has(m.id)), ...sorted.filter((m) => s.off.has(m.id))];
  const current = video ? s.vidModel : s.imgModel;
  // Images can also be compared: tick two to four models and the same prompt runs on each.
  const canCompare = !video && !s.ref;
  const [multi, setMulti] = useState(canCompare && Boolean(comparePlan(s.compare)));
  const [picked, setPicked] = useState(() => (comparePlan(s.compare) ? s.compare : [s.imgModel]));
  const plan = comparePlan(picked);
  const canAuto = canCompare || (video && !s.ref); // Auto: for images, and for a video made from words
  const autoOn = video ? canAuto && s.vAuto : canCompare && s.auto && !comparePlan(s.compare);
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= MAX_COMPARE ? (s.say(t("Up to {n} models at a time.", { n: MAX_COMPARE })), p) : [...p, id]));
  const fromImage = Boolean(video && s.ref); // the video will start from the attached image
  const sub = video ? (fromImage ? t("Prices are for a video that starts from your image, at the standard setting.") : t("Prices are for the standard setting. Length and quality change the price."))
    : multi ? t("Tick 2 to {n} models. Your prompt runs on each one, and you pay each model's price.", { n: MAX_COMPARE }) : t("The price is for one image.");
  return (
    <Sheet title={video ? t("Video models") : t("Image models")} sub={sub} onClose={onClose}>
      {canCompare ? (
        <div className="seg" role="tablist" aria-label={t("How many models")} style={{ display: "flex", margin: "0 8px 10px" }}>
          <button role="tab" aria-selected={!multi} className={multi ? "" : "on"} style={{ flex: 1 }} onClick={() => setMulti(false)}>{t("One model")}</button>
          <button role="tab" aria-selected={multi} className={multi ? "on" : ""} style={{ flex: 1 }} onClick={() => setMulti(true)}>{t("Compare models")}</button>
        </div>
      ) : null}
      <div className="r" style={{ gap: 6, padding: "0 8px 8px" }}>
        <button className={`chip${sort === "best" ? " on" : ""}`} onClick={() => setSort("best")}>{t("Best quality")}</button>
        <button className={`chip${sort === "price" ? " on" : ""}`} onClick={() => setSort("price")}>{t("Lowest price")}</button>
      </div>
      {canAuto && !multi ? (
        <button className={`mrow mauto${autoOn ? " on" : ""}`} aria-pressed={autoOn} onClick={() => { (video ? s.setVAuto : s.setAuto)(true); onClose(); }}>
          <span className="grow">
            <span className="r" style={{ gap: 8 }}><span className="b" style={{ fontSize: 16 }}>{t("Auto")}</span><span className="rec">{t("Recommended")}</span></span>
            <span className="b" style={{ display: "block", marginTop: 2 }}>{t("We pick the best model for your prompt")}</span>
            <span className="sm t2" style={{ display: "block" }}>{t("You see the model and its price before you generate.")}</span>
          </span>
          {autoOn ? <span className="tick"><Icon name="check" size={14} /></span> : null}
        </button>
      ) : null}
      {list.map((m) => {
        const on = multi ? picked.includes(m.id) : m.id === current && !autoOn && !(canCompare && comparePlan(s.compare));
        if (s.off.has(m.id)) return (
          <button key={m.id} className="mrow" disabled aria-disabled="true">
            <span className="grow">
              <span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span>
              <span className="sm t3" style={{ display: "block" }}>{t("Temporarily unavailable")}</span>
            </span>
          </button>
        );
        return (
          <button key={m.id} className={`mrow${on ? " on" : ""}`} aria-pressed={on}
            onClick={() => { if (multi) { toggle(m.id); return; } (video ? s.setVidModel : s.setImgModel)(m.id); onClose(); }}>
            {multi ? <span className={`box${on ? " on" : ""}`} aria-hidden="true">{on ? <Icon name="check" size={14} /> : null}</span> : null}
            <span className="grow">
              <span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span>
              <span className="sm t2" style={{ display: "block" }}>{t(m.desc)}</span>
            </span>
            {!multi && on ? <span className="tick"><Icon name="check" size={14} /></span> : null}
            <Price n={fromImage ? (videoTakesImage(m.id) ? videoPlan(m.id, undefined, undefined, s.ref.ratio, true)?.cost ?? m.cost : TOOLS.animate.cost) : m.cost} />
          </button>
        );
      })}
      {multi ? (
        <div className="sheet-foot">
          <button className="btn btn-p btn-wide btn-split" disabled={!plan} onClick={() => { s.setAuto(false); s.setCompare(plan.models.map((m) => m.id)); onClose(); }}>
            <span>{plan ? t("Compare {n} models", { n: plan.models.length }) : t("Tick at least 2 models")}</span>{plan ? <Price n={plan.cost} /> : null}
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}

export function RatioSheet({ s, onClose }) {
  const box = { "1:1": [18, 18], "9:16": [12, 20], "16:9": [22, 13] };
  return (
    <Sheet title={t("Shape")} onClose={onClose}>
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
  const va = s.vAuto && !s.ref ? recommend(s.prompt, "video", s.wallet, s.off, (id) => videoPlan(id, s.vDur, s.vRes, s.ratio)?.cost, VIDEO_AUTO_CAP) : null; // Auto: the model it would run
  const m = videoModel(va?.pick || s.vidModel);
  const img = Boolean(s.ref && videoTakesImage(m.id)); // the video starts from a picture: its own price, and the picture's shape
  const plan = videoPlan(m.id, s.vDur, s.vRes, img ? s.ref.ratio : s.ratio, img);
  const Group = ({ label, children }) => <div style={{ padding: "8px 8px 12px" }}><p className="sm b t2" style={{ marginBottom: 8 }}>{label}</p><div className="opt">{children}</div></div>;
  return (
    <Sheet title={t("Video settings")} sub={t("{name}. The price changes with length and quality.", { name: m.name })} onClose={onClose}>
      <Group label={t("Length")}>
        {plan.durations.map((d) => {
          const c = videoOptionCost(m.id, d, plan.r, img);
          return <button key={d} className={d === plan.d ? "on" : ""} aria-pressed={d === plan.d} disabled={c === null} onClick={() => s.setVDur(d)}><span>{t("{n} seconds", { n: d })}</span>{c !== null ? <Price n={c} /> : <span className="sm">{t("Not at {what}", { what: plan.r })}</span>}</button>;
        })}
      </Group>
      <Group label={t("Quality")}>
        {plan.resolutions.map((r) => {
          const c = videoOptionCost(m.id, plan.d, r, img);
          return <button key={r} className={r === plan.r ? "on" : ""} aria-pressed={r === plan.r} disabled={c === null} onClick={() => s.setVRes(r)}><span>{resLabel(r)}</span>{c !== null ? <Price n={c} /> : <span className="sm">{t("Not at {what}", { what: `${plan.d} s` })}</span>}</button>;
        })}
      </Group>
      {plan.resolutions.includes("360p") ? <p className="sm t2" style={{ padding: "0 8px 12px", marginTop: -4 }}>{t("Draft is a quick, low-quality try (360p). Use it to test an idea before you pay for full quality.")}</p> : null}
      {img ? <p className="sm t2" style={{ padding: "0 8px 12px" }}>{t("The video keeps the shape of your image.")}</p> : (
        <Group label={t("Shape")}>
          {plan.ratios.map((r) => <button key={r} className={r === plan.ratio ? "on" : ""} aria-pressed={r === plan.ratio} onClick={() => s.setRatio(r)}><span>{r}</span></button>)}
        </Group>
      )}
      <div style={{ padding: "4px 8px 0" }}><button className="btn btn-p btn-wide btn-split" onClick={onClose}><span>{t("Done")}</span><Price n={plan.cost} /></button></div>
    </Sheet>
  );
}

export function PricingSheet({ s, need, label, paidOnly, onClose }) {
  const w = s.wallet;
  const [busy, setBusy] = useState("");
  const plans = (w.plans || []).filter((p) => p.credits);
  const open = plans.some((p) => p.enabled);
  const sub = need
    ? `${label ? tn(N("{name} costs 1 credit."), N("{name} costs {n} credits."), { name: label, n: need }) : tn(N("This costs 1 credit."), N("This costs {n} credits."), { n: need })} ${paidOnly ? t("Video and a few tools use bought credits only; free credits don't cover them.") : t("You have {free} free and {paid} bought; one generation is paid from one of them, not a mix.", { free: w.free, paid: w.paid })}`
    : t("Credits work on every model. Bought credits are used after your free ones.");
  return (
    <Sheet title={t("Add credits")} sub={sub} onClose={onClose}>
      <div className="c" style={{ gap: 8, padding: "4px 8px" }}>
        {plans.map((p) => (
          <div key={p.id} className="plan">
            <div className="grow">
              <p className="b" style={{ fontSize: 16 }}>{p.name}</p>
              <p className="sm t2 r" style={{ gap: 6 }}><i className="coin" />{p.period === "month" ? t("{n} credits, every month", { n: num(p.credits) }) : t("{n} credits, one payment", { n: num(p.credits) })}</p>
            </div>
            <button className="btn btn-p" disabled={!p.enabled || Boolean(busy)} onClick={async () => { setBusy(p.id); await s.buy(p.id); setBusy(""); }}>
              {busy === p.id ? <i className="spin" /> : p.price}{p.period === "month" && busy !== p.id ? <span style={{ opacity: 0.7 }}>{t("/mo")}</span> : null}
            </button>
          </div>
        ))}
        {!open ? <p className="sm t2" style={{ padding: "4px 8px" }}>{t("Payments are opening soon. Until then you can keep creating with free credits.")}</p> : null}
        {w.guest && !paidOnly ? <button className="btn btn-s btn-wide" onClick={() => s.askSignIn()}>{t("Create an account for {n} free credits a day", { n: FREE_DAILY })}</button> : null}
        <button className="btn btn-wide" onClick={() => { onClose(); s.setPage("pricing"); }}>{t("Models & pricing")}</button>
      </div>
    </Sheet>
  );
}

// Asks for one line of text before running a tool (Edit with words, Keep the face).
export function AskSheet({ s, tool, item, onClose }) {
  const tl = TOOLS[tool];
  const [text, setText] = useState("");
  const go = () => { const v = text.trim(); if (!v) return; onClose(); s.runTool(tool, item, tool === "facelock" ? { prompt: v, aspectRatio: IMAGE_RATIOS.some((r) => r.id === item.ratio) ? item.ratio : "1:1" } : { prompt: v }); };
  return (
    <Sheet title={t(tl.ask)} sub={tool === "facelock" ? t("The face from this photo is kept; everything else follows your description.") : t("The rest of the image stays as it is. The original is kept in your Library.")} onClose={onClose}>
      <div className="c" style={{ gap: 12, padding: "4px 8px" }}>
        <textarea className="field" autoFocus maxLength={1500} value={text} placeholder={t(tl.hint)} aria-label={t(tl.ask)} onChange={(e) => setText(e.target.value)} />
        {item.id ? <ImproveBar s={s} text={text} setText={setText} edit={tool === "facelock" ? "face" : "edit"} image={item.id} /> : null}
        <button className="btn btn-p btn-wide btn-split" disabled={!text.trim()} onClick={go}><span>{t(tl.label)}</span><Price n={tl.cost} /></button>
      </div>
    </Sheet>
  );
}

// Projects: add an item to one ("pick"), start one ("new"), or rename and delete one ("edit").
export function ProjectSheet({ s, mode, item, id, onClose }) {
  const proj = s.projects.find((p) => p.id === id);
  const [view, setView] = useState(mode); // pick | new | edit | delete
  const [name, setName] = useState(mode === "edit" ? proj?.name || "" : "");
  const [busy, setBusy] = useState(false);
  const current = item ? (s.items.find((x) => x.id === item.id) ?? item).project || null : null;
  const pick = async (pid) => {
    if (busy) return;
    if (pid === current) { onClose(); return; }
    setBusy(true); const ok = await s.moveItem(item, pid); setBusy(false);
    if (ok) onClose();
  };
  const create = async (e) => {
    e?.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true);
    const p = await s.createProject(name);
    if (p && item) await s.moveItem(item, p.id); else if (p) s.setProject(p.id); // started from the Library: open it
    setBusy(false);
    if (p) onClose();
  };
  const rename = async (e) => {
    e?.preventDefault();
    if (busy || !name.trim()) return;
    setBusy(true); const ok = await s.renameProject(id, name); setBusy(false);
    if (ok) onClose();
  };
  const del = async () => { if (busy) return; setBusy(true); const ok = await s.deleteProject(id); setBusy(false); if (ok) onClose(); };
  const field = <input className="field" autoFocus maxLength={40} value={name} placeholder={t("Project name")} aria-label={t("Project name")} onChange={(e) => setName(e.target.value)} />;

  if (view === "new") return (
    <Sheet title={t("New project")} sub={item ? t("This item is added to it.") : t("A project keeps related images and videos together.")} onClose={onClose}>
      <form className="c" style={{ gap: 12, padding: "4px 8px" }} onSubmit={create}>
        {field}
        <button className="btn btn-p btn-wide" disabled={busy || !name.trim()}>{busy ? <i className="spin" /> : t("Create project")}</button>
      </form>
    </Sheet>
  );
  if (view === "edit") return (
    <Sheet title={t("Project")} onClose={onClose}>
      <form className="c" style={{ gap: 12, padding: "4px 8px" }} onSubmit={rename}>
        {field}
        <button className="btn btn-p btn-wide" disabled={busy || !name.trim() || name.trim() === proj?.name}>{busy ? <i className="spin" /> : t("Save name")}</button>
        <button type="button" className="btn btn-wide" onClick={() => setView("delete")}><Icon name="trash" size={18} />{t("Delete project")}</button>
      </form>
    </Sheet>
  );
  if (view === "delete") return (
    <Sheet title={t("Delete this project?")} onClose={onClose}>
      <div className="c" style={{ gap: 12, padding: "4px 8px" }}>
        <p className="t2">{proj?.count ? (proj.count === 1 ? t("Its 1 item stays in your Library. Only the project \"{name}\" goes.", { name: proj.name }) : t("Its {n} items stay in your Library. Only the project \"{name}\" goes.", { n: proj.count, name: proj.name })) : t("\"{name}\" is empty.", { name: proj?.name || t("This project") })}</p>
        <button className="btn btn-p btn-wide" disabled={busy} onClick={del}>{busy ? <i className="spin" /> : t("Delete project")}</button>
        <button className="btn btn-s btn-wide" onClick={onClose}>{t("Keep it")}</button>
      </div>
    </Sheet>
  );
  return (
    <Sheet title={t("Add to a project")} onClose={onClose}>
      {s.projects.map((p) => (
        <button key={p.id} className={`mrow${p.id === current ? " on" : ""}`} aria-pressed={p.id === current} disabled={busy} onClick={() => pick(p.id)}>
          <Icon name="folder" />
          <span className="grow b clamp1" style={{ fontSize: 16, textAlign: "left" }}>{p.name}</span>
          {p.id === current ? <span className="tick"><Icon name="check" size={14} /></span> : <span className="sm t3 num">{p.count}</span>}
        </button>
      ))}
      {current ? <button className="mrow" disabled={busy} onClick={() => pick(null)}><Icon name="x" /><span className="grow b" style={{ fontSize: 16, textAlign: "left" }}>{t("Take out of the project")}</span></button> : null}
      <button className="mrow" disabled={busy} onClick={() => { setName(""); setView("new"); }}><Icon name="plus" /><span className="grow b" style={{ fontSize: 16, textAlign: "left" }}>{t("New project")}</span></button>
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
    const timer = setInterval(() => { if (document.visibilityState === "visible") check(); }, 4000);
    const onVis = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVis); window.addEventListener("focus", onVis);
    return () => { stop = true; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [step, s.signedIn]);
  const post = async (url, body) => { const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { ok: r.ok, d: await r.json().catch(() => ({})) }; };
  const send = async (e) => {
    e?.preventDefault(); if (busy || !email.includes("@")) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/start", { email, lang: s.lang }).catch(() => ({ ok: false, d: {} }));
    setBusy(false); if (ok) { setStep("code"); setCode(""); } else setErr(sm(d.error) || t("The email couldn't be sent. Try again."));
  };
  const verify = async (e) => {
    e?.preventDefault(); if (busy || code.length < 6) return; setBusy(true); setErr("");
    const { ok, d } = await post("/api/auth/verify", { email, code }).catch(() => ({ ok: false, d: {} }));
    setBusy(false); if (ok) s.signedIn(); else setErr(sm(d.error) || t("That code didn't work. Check it and try again."));
  };
  return (
    <Sheet title={step === "email" ? t("Sign in or create an account") : t("Check your email")} sub={step === "email" ? reason || t("One step, no password. {n} free credits every day.", { n: FREE_DAILY }) : null} onClose={onClose}>
      {step === "email" ? (
        <form className="c" style={{ gap: 10, padding: "4px 8px" }} onSubmit={send}>
          {google ? (
            <>
              <a className="btn btn-s btn-wide" style={{ height: 52 }} href="/api/auth/google">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" /><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" /><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" /><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" /></svg>
                {t("Continue with Google")}
              </a>
              <p className="sm t3" style={{ textAlign: "center" }}>{t("or with your email")}</p>
            </>
          ) : null}
          <input className="field" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" aria-label={t("Email address")} value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="btn btn-p btn-wide" style={{ height: 52 }} disabled={busy || !email.includes("@")}>{busy ? <i className="spin" /> : t("Continue with email")}</button>
          {err ? <p className="sm bad" role="alert">{err}</p> : null}
        </form>
      ) : (
        <form className="c" style={{ gap: 10, padding: "4px 8px" }} onSubmit={verify}>
          <p className="t2">{rich(t("We sent an email to <b>{email}</b>.", { email }), { b: (c) => <b style={{ color: "var(--text)" }}>{c}</b> })}</p>
          <div className="card" style={{ padding: "4px 16px" }}>
            <p className="lrow" style={{ padding: 0 }}><span className="b num t3">1</span><span className="grow">{t("Open the email on this device.")}</span></p>
            <p className="lrow" style={{ padding: 0 }}><span className="b num t3">2</span><span className="grow">{t("Tap the link inside it.")}</span></p>
            <p className="lrow" style={{ padding: 0 }}><span className="b num t3">3</span><span className="grow">{t("You're signed in. This page updates by itself.")}</span></p>
          </div>
          <p className="sm t3">{t("Nothing in a minute? Look in the spam folder, or send it again.")}</p>
          {showCode ? (
            <>
              <input className="field num" inputMode="numeric" autoComplete="one-time-code" autoFocus maxLength={10} placeholder={t("Code from the email")} aria-label={t("Code from the email")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
              <button className="btn btn-p btn-wide" disabled={busy || code.length < 6}>{busy ? <i className="spin" /> : t("Sign in with the code")}</button>
            </>
          ) : null}
          {err ? <p className="sm bad" role="alert">{err}</p> : null}
          <div className="r" style={{ gap: 16, flexWrap: "wrap" }}>
            <button type="button" className="link sm" style={{ minHeight: 44 }} onClick={send} disabled={busy}>{t("Send it again")}</button>
            <button type="button" className="link sm" style={{ minHeight: 44 }} onClick={() => { setStep("email"); setErr(""); setShowCode(false); }}>{t("Use another email")}</button>
            {showCode ? null : <button type="button" className="link sm" style={{ minHeight: 44 }} onClick={() => setShowCode(true)}>{t("The email has a code")}</button>}
          </div>
        </form>
      )}
    </Sheet>
  );
}

// Ideas to start from: the same cards a newcomer sees on the Create screen, one tap away for everyone else.
// Today's free improvements are used: the Pro one is offered instead, with its price.
export function ImproveProSheet({ s, limit, onClose }) {
  return (
    <Sheet title={t("Improve with Pro")} sub={t("You've used today's {n} free improvements. They come back tomorrow.", { n: limit || 10 })} onClose={onClose}>
      <div className="c" style={{ gap: 12, padding: "4px 8px" }}>
        <p className="t2">{t("Pro uses the strongest model to write a fuller prompt: scene, subjects, action, camera, light and expressions.")}</p>
        <button className="btn btn-p btn-wide btn-split" onClick={() => { onClose(); s.improveNow("pro"); }}><span>{t("Improve with Pro")}</span><Price n={1} /></button>
      </div>
    </Sheet>
  );
}

// What the model was given, when a short idea was filled in first.
export function UsedSheet({ s, text, idea, onClose }) {
  return (
    <Sheet title={t("The prompt that was used")} sub={t("Your idea was filled in before it was made. This is what the model got.")} onClose={onClose}>
      <div style={{ padding: "0 8px 8px" }}>
        {idea ? <p className="sm t3" style={{ marginBottom: 10 }}>{t("Your idea")}: {idea}</p> : null}
        <p style={{ fontSize: 16, lineHeight: "24px", overflowWrap: "anywhere" }}>{text}</p>
        <button className="btn btn-s btn-wide" style={{ marginTop: 16 }} onClick={() => { s.setPrompt(text); onClose(); }}>{t("Use this prompt")}</button>
      </div>
    </Sheet>
  );
}

export function IdeasSheet({ s, onClose }) {
  const list = ideaCards(s.explore.items, s.mode === "video");
  return (
    <Sheet title={t("Ideas to start from")} sub={t("Tap one to put it in the prompt box. Then change it to make it yours.")} onClose={onClose}>
      <div className="ideas in-sheet">
        {list.map((x) => (
          <button key={x.key} className="idea2" onClick={() => { s.setPrompt(x.prompt); onClose(); }} aria-label={t("Use this idea: {title}", { title: x.title.slice(0, 80) })}>
            <img src={x.src} alt="" loading="lazy" decoding="async" />
            <span><b className="clamp2">{x.title}</b></span>
          </button>
        ))}
      </div>
    </Sheet>
  );
}

// The profile menu: who is signed in, the credits, and the way to everything that is not a tab.
export function MeSheet({ s, onClose }) {
  const w = s.wallet;
  const guest = w.loaded && !w.account && !w.admin;
  const go = (page) => { onClose(); s.setPage(page); };
  const row = (icon, label, onClick) => <button className="lrow" onClick={onClick}><Icon name={icon} style={{ color: "var(--text-2)" }} /><span className="grow" style={{ textAlign: "left" }}>{label}</span><Icon name="right" size={18} style={{ color: "var(--text-3)" }} /></button>;
  return (
    <Sheet title={guest ? t("Welcome") : t("Account")} onClose={onClose}>
      <div className="c" style={{ gap: 12, padding: "4px 8px 8px" }}>
        {guest ? (
          <div className="wal">
            <p className="d" style={{ fontSize: 22, lineHeight: "28px" }}>{t("Sign up and get {n} free credits every day", { n: FREE_DAILY })}</p>
            <p className="sm t2" style={{ margin: "6px 0 14px" }}>{t("One step, no password. Your work is kept on every device.")}</p>
            <button className="btn btn-p btn-wide" onClick={() => { onClose(); s.askSignIn(); }}>{t("Sign up or sign in")}</button>
            {w.paid > 0 ? <p className="sm t2" style={{ marginTop: 12 }}>{t("This browser holds {n} bought credits. They move into your account when you sign in.", { n: num(w.paid) })}</p> : null}
          </div>
        ) : (
          <>
            {w.account ? <div className="r" style={{ gap: 12, padding: "0 4px" }}><span className="av big">{w.account.email.trim().charAt(0).toUpperCase()}</span><div className="grow"><p className="b clamp1">{w.account.email}</p><p className="sm t2">{t("Signed in")}</p></div></div> : null}
            {w.admin ? (
              <div className="wal">
                <p className="d" style={{ fontSize: 22, lineHeight: "28px" }}>{t("Admin mode")}</p>
                <p className="sm t2" style={{ margin: "6px 0 12px" }}>{t("Nothing is charged while admin mode is on, so your credits are not shown.")}</p>
                <div className="r" style={{ gap: 8, flexWrap: "wrap" }}>
                  <form method="post" action="/api/admin" className="grow"><input type="hidden" name="logout" value="1" /><button className="btn btn-p btn-wide" type="submit">{t("Turn off admin mode")}</button></form>
                  <a className="btn btn-s" href="/admin">{t("Admin page")}</a>
                </div>
              </div>
            ) : (
              <div className="wal">
                <div className="r" style={{ justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
                  <div>
                    <p className="sm t2">{t("Credits")}</p>
                    <p className="d num r" style={{ fontSize: 34, lineHeight: "38px", gap: 8 }}><i className="coin" style={{ width: 14, height: 14 }} />{w.loaded ? num(w.free + w.paid) : "…"}</p>
                  </div>
                  <button className="btn btn-p" onClick={() => { onClose(); s.askCredits(0); }}>{t("Add credits")}</button>
                </div>
                <p className="sm t2" style={{ marginTop: 8 }}>{t("{paid} bought, {free} of {limit} free today", { paid: num(w.paid), free: w.free, limit: w.freeLimit })}</p>
              </div>
            )}
          </>
        )}
        <div className="card flat">
          {row("coins", t("Models & pricing"), () => go("pricing"))}
          {row("gear", t("Settings"), () => go("settings"))}
          {row("help", t("Help"), () => go("help"))}
        </div>
        {w.account ? <div className="card flat"><button className="lrow" onClick={s.signOut}><Icon name="logout" style={{ color: "var(--text-2)" }} /><span className="grow" style={{ textAlign: "left" }}>{t("Sign out")}</span></button></div> : null}
      </div>
    </Sheet>
  );
}

// The language of the interface. Each language is written in its own name, so it can be found by anyone.
export function LangSheet({ s, onClose }) {
  return (
    <Sheet title={t("Language")} onClose={onClose}>
      <div className="c" style={{ padding: "4px 8px 8px" }}>
        <div className="card flat" role="radiogroup" aria-label={t("Language")}>
          {LANGS.map((l) => (
            <button key={l.id} className="lrow" role="radio" aria-checked={s.lang === l.id} lang={l.tag} onClick={async () => { await s.setLang(l.id); onClose(); }}>
              <span className="grow" style={{ textAlign: "left" }}>{l.name}</span>
              {s.lang === l.id ? <Icon name="check" size={20} /> : null}
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
