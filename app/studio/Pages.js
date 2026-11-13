"use client";
import { t, tn, N, tm, num, langTag, LANGS } from "../i18n/index.js";
import { rich } from "../i18n/rich.js";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price, lockScroll } from "./bits";
import { imageModels, videoModels, TOOLS } from "./models";
import { FREE_DAILY, BUILD } from "./store";

const THEMES = [["dark", N("Dark")], ["light", N("Light")], ["auto", N("Match device")]];
const ABOUT = [[N("Terms"), "/terms"], [N("Privacy"), "/privacy"], [N("Refunds"), "/refund-policy"], [N("Content policy"), "/content-policy"], [N("Contact us"), "/contact"]];

// A full page that lies over the tabs, with a way back. Used for Settings, Models & pricing and Help.
function Page({ title, s, children }) {
  useEffect(() => lockScroll(), []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !s.sheet) s.setPage(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.sheet, s.setPage]);
  return (
    <div className="page" role="dialog" aria-modal="true" aria-label={title}>
      <div className="page-in">
        <header className="top">
          <button className="ib" aria-label={t("Back")} onClick={() => s.setPage(null)}><Icon name="left" /></button>
          <h1 className="b" style={{ fontSize: 17, lineHeight: "24px" }}>{title}</h1>
          <span style={{ width: 44 }} />
        </header>
        <div className="pad" style={{ paddingBottom: 40 }}>{children}</div>
      </div>
    </div>
  );
}
const Sec = ({ children }) => <h2 className="sec">{children}</h2>;

function Purchases() {
  const [st, setSt] = useState({ status: "loading", items: [] });
  useEffect(() => {
    let live = true;
    fetch("/api/account/purchases", { cache: "no-store" }).then((r) => r.json().then((d) => ({ ok: r.ok, d }))).then(({ ok, d }) => { if (live) setSt(ok ? { status: "ready", items: d.items || [] } : { status: "error", items: [] }); }).catch(() => { if (live) setSt({ status: "error", items: [] }); });
    return () => { live = false; };
  }, []);
  if (st.status === "loading") return <div className="lrow t2"><i className="spin" />{t("Loading")}</div>;
  if (st.status === "error") return <div className="lrow t2">{t("Your purchases could not be loaded. Try again in a moment.")}</div>;
  if (!st.items.length) return <div className="lrow t2">{t("No purchases yet.")}</div>;
  return st.items.map((p) => (
    <div key={p.id} className="lrow two">
      <span className="grow"><span className="b" style={{ display: "block" }}>{tm(p.name)}</span><span className="sm t2" style={{ display: "block" }}>{new Date(p.at).toLocaleDateString(langTag(), { year: "numeric", month: "short", day: "numeric" })}{p.price ? `, ${p.price}` : ""}</span></span>
      <Price n={num(p.credits)} />
    </div>
  ));
}

export function Settings({ s }) {
  const w = s.wallet;
  const [open, setOpen] = useState(""); // "purchases" | "delete"
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const del = async () => { if (busy || word.trim() !== "DELETE") return; setBusy(true); setErr(""); const e = await s.deleteAccount(); if (e) { setErr(e); setBusy(false); } };
  return (
    <Page title={t("Settings")} s={s}>
      <Sec>{t("Appearance")}</Sec>
      <div className="seg" role="tablist" aria-label={t("Appearance")} style={{ display: "flex" }}>
        {THEMES.map(([id, label]) => <button key={id} role="tab" aria-selected={s.theme === id} className={s.theme === id ? "on" : ""} style={{ flex: "1 1 0", padding: "0 8px" }} onClick={() => s.setTheme(id)}>{t(label)}</button>)}
      </div>

      <Sec>{t("Language")}</Sec>
      <div className="card">
        <button className="lrow" onClick={() => s.setSheet({ type: "lang" })}><Icon name="globe" style={{ color: "var(--text-3)" }} /><span className="grow" style={{ textAlign: "left" }}>{(LANGS.find((l) => l.id === s.lang) || LANGS[0]).name}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></button>
      </div>
      <p className="sm t3" style={{ margin: "8px 2px 0" }}>{t("Prompts can be written in any language. They are translated for the models by themselves, and text in quotes stays exactly as you wrote it.")}</p>

      <Sec>{t("Account")}</Sec>
      {w.account ? (
        <div className="card">
          <div className="lrow"><Icon name="mail" style={{ color: "var(--text-3)" }} /><span className="grow clamp1">{w.account.email}</span></div>
          <button className="lrow" aria-expanded={open === "purchases"} onClick={() => setOpen(open === "purchases" ? "" : "purchases")}><Icon name="receipt" style={{ color: "var(--text-3)" }} /><span className="grow" style={{ textAlign: "left" }}>{t("Purchases")}</span><Icon name={open === "purchases" ? "down" : "right"} style={{ color: "var(--text-3)" }} /></button>
          {open === "purchases" ? <Purchases /> : null}
          <button className="lrow bad" aria-expanded={open === "delete"} onClick={() => { setOpen(open === "delete" ? "" : "delete"); setErr(""); }}><Icon name="trash" /><span className="grow" style={{ textAlign: "left" }}>{t("Delete account")}</span><Icon name={open === "delete" ? "down" : "right"} /></button>
          {open === "delete" ? (
            <div className="delbox">
              <p>{t("This deletes your account, every image and video you made, your projects and favorites.")} {w.paid > 0 ? `${t("Your {n} bought credits are lost.", { n: num(w.paid) })} ` : ""}{t("It can't be undone.")}</p>
              <label className="sm t2" htmlFor="del-word" style={{ display: "block", margin: "12px 0 6px" }}>{t("Type DELETE to confirm")}</label>
              <input id="del-word" className="field" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
              {err ? <p className="sm bad" role="alert" style={{ marginTop: 8 }}>{err}</p> : null}
              <div className="r" style={{ gap: 8, marginTop: 12 }}>
                <button className="btn btn-danger" disabled={busy || word.trim() !== "DELETE"} onClick={del}>{busy ? <i className="spin" /> : null}{t("Delete my account")}</button>
                <button className="btn btn-s" onClick={() => { setOpen(""); setWord(""); }}>{t("Keep it")}</button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="card">
          <button className="lrow" onClick={() => { s.setPage(null); s.askSignIn(); }}><Icon name="person" style={{ color: "var(--text-3)" }} /><span className="grow" style={{ textAlign: "left" }}>{t("Sign up or sign in")}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></button>
        </div>
      )}

      <Sec>{t("About")}</Sec>
      <div className="card">
        {ABOUT.map(([name, h]) => <a key={h} className="lrow" href={h}><span className="grow">{t(name)}</span><Icon name="right" style={{ color: "var(--text-3)" }} /></a>)}
      </div>
      <p className="sm t3 num" style={{ marginTop: 20, textAlign: "center" }}>{t("Version {build}", { build: BUILD })}</p>
    </Page>
  );
}

const EDITING = [
  [TOOLS.sharpen.label, N("The same image at twice the size"), TOOLS.sharpen.cost],
  [TOOLS.cutout.label, N("A transparent PNG"), TOOLS.cutout.cost],
  [TOOLS.reference.label, N("A new image that follows one you add"), TOOLS.reference.cost],
  [TOOLS.facelock.label, N("The same face in a new scene. Bought credits only"), TOOLS.facelock.cost],
  [TOOLS.edit.label, N("Describe a change to an image you have"), TOOLS.edit.cost],
  [TOOLS.repaint.label, N("Paint over a part and replace it"), TOOLS.repaint.cost],
  [TOOLS.animate.label, N("A 5 second video from an image. Bought credits only"), TOOLS.animate.cost],
];

// Models & pricing: what credits cost, and what each model and tool costs in credits. A tap on a model opens
// Create with it chosen.
export function Pricing({ s }) {
  const w = s.wallet;
  const [kind, setKind] = useState("image");
  const [busy, setBusy] = useState("");
  const plans = (w.plans || []).filter((p) => p.credits);
  const every = kind === "video" ? videoModels : imageModels;
  const list = [...every.filter((m) => !s.off.has(m.id)), ...every.filter((m) => s.off.has(m.id))]; // the ones that are down right now come last, marked
  const pick = (m) => {
    if (kind === "video") { s.setMode("video"); s.setVidModel(m.id); } else { s.setMode("image"); s.setImgModel(m.id); }
    s.setPage(null);
    if (s.needAccount({ tab: "create" })) return;
    s.setTab("create");
  };
  return (
    <Page title={t("Models & pricing")} s={s}>
      {plans.length ? (
        <div className="packs">
          {plans.map((p, i) => (
            <div key={p.id} className="pack">
              <p className="sm t2">{p.name}</p>
              <p className="d num" style={{ fontSize: 24, lineHeight: "30px", margin: "2px 0 10px" }}><Price n={num(p.credits)} /></p>
              <button className={`btn ${i === 0 ? "btn-p" : "btn-s"} btn-wide`} style={{ height: 44 }} disabled={!p.enabled || Boolean(busy)} onClick={async () => { setBusy(p.id); await s.buy(p.id); setBusy(""); }}>
                {busy === p.id ? <i className="spin" /> : <>{p.price}{p.period === "month" ? " / mo" : ""}</>}
              </button>
              <p className="sm t3" style={{ marginTop: 8 }}>{p.period === "month" ? t("Every month") : t("One payment")}</p>
            </div>
          ))}
        </div>
      ) : null}
      {plans.length && !plans.some((p) => p.enabled) ? <p className="sm t2" style={{ marginTop: 10 }}>{t("Payments are opening soon. Until then you can keep creating with free credits.")}</p> : null}
      <p className="sm t2" style={{ margin: "12px 2px 0" }}>{t("One wallet for every model. An account gets {n} free credits every day, used before bought ones. The price is on the button before you tap, and a run that fails costs nothing.", { n: FREE_DAILY })}</p>

      <div className="seg" role="tablist" aria-label={t("Kind")} style={{ display: "flex", marginTop: 22 }}>
        {[["image", t("Images")], ["video", t("Video")], ["edit", t("Editing")]].map(([id, label]) => <button key={id} role="tab" aria-selected={kind === id} className={kind === id ? "on" : ""} style={{ flex: "1 1 0", padding: "0 8px" }} onClick={() => setKind(id)}>{label}</button>)}
      </div>
      {kind === "edit" ? (
        <>
          <div className="mlist">{EDITING.map(([name, desc, cost]) => <div key={name}><span className="grow"><span className="b" style={{ display: "block", fontSize: 16 }}>{t(name)}</span><span className="sm t2" style={{ display: "block" }}>{t(desc)}</span></span><Price n={cost} /></div>)}</div>
          <p className="sm t3" style={{ marginTop: 8 }}>{t("Open any image you made to use these.")}</p>
        </>
      ) : (
        <>
          <div className="mlist">
            {list.map((m) => s.off.has(m.id) ? (
              <button key={m.id} disabled aria-disabled="true" style={{ width: "100%", textAlign: "left" }}>
                <span className="grow"><span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span><span className="sm t3" style={{ display: "block" }}>{t("Temporarily unavailable")}</span></span>
              </button>
            ) : (
              <button key={m.id} onClick={() => pick(m)} style={{ width: "100%", textAlign: "left" }} aria-label={tn(N("{name}, 1 credit. Create with this model"), N("{name}, {n} credits. Create with this model"), { name: m.name, n: m.cost })}>
                <span className="grow"><span className="b" style={{ display: "block", fontSize: 16 }}>{m.name}</span><span className="sm t2" style={{ display: "block" }}>{m.by}. {t(m.desc)}</span></span>
                <Price n={m.cost} />
              </button>
            ))}
          </div>
          <p className="sm t3" style={{ marginTop: 8 }}>{kind === "video" ? t("Price for the shortest clip. Video uses bought credits. Tap a model to create with it.") : t("Price for one image. Tap a model to create with it.")}</p>
        </>
      )}
      <p className="sm t2" style={{ marginTop: 22 }}>{rich(t("More about credits, refunds and payments on the <a>full prices page</a>."), { a: (c) => <a className="link" href="/pricing">{c}</a> })}</p>
    </Page>
  );
}

const QA = [
  [N("How do credits work?"), N("One wallet pays for every model: images, video and editing. An account gets {n} free credits every day, and they are used first. Bought credits are used after that. The price is always on the button before you tap.")],
  [N("What if a creation fails?"), N("You don't pay for it. If an image or video doesn't finish, its credits go back to your wallet by themselves.")],
  [N("Where are my images and videos?"), N("Everything you make is saved in your Library. A video keeps rendering if you close the site, and is waiting in your Library when you come back.")],
  [N("Can I write prompts in my own language?"), N("Yes, in any language. Your prompt is translated for the models by itself. Text in quotes stays exactly as you wrote it, because that is text meant to appear in the picture.")],
  [N("Which model should I pick?"), N("Choose Auto and the site picks a model that fits your prompt, showing the price first. Compare runs the same prompt on several models side by side. Models & pricing says what each model is good at.")],
  [N("How do I change an image I made?"), N("Open it. Under the picture you can upscale it, remove the background, change it with words, paint over one area and replace it, or turn it into a short video.")],
  [N("Why does video need bought credits?"), N("A video costs many times more to make than an image, so free credits don't cover video and a few tools. The button tells you before you tap.")],
  [N("Can I get a refund?"), N("Yes. Unused bought credits can be refunded within 14 days."), ["/refund-policy", N("Refund policy")]],
  [N("How do I delete something, or my account?"), N("Open an image or video and tap the bin to delete it. To delete your account and everything in it, go to Settings.")],
];

export function Help({ s }) {
  return (
    <Page title={t("Help")} s={s}>
      <div className="card" style={{ marginTop: 6 }}>
        {QA.map(([q, a, link]) => (
          <details key={q} className="qa">
            <summary><span className="grow">{t(q)}</span><Icon name="down" style={{ color: "var(--text-3)" }} /></summary>
            <p className="t2">{t(a, { n: FREE_DAILY })}{link ? <> <a className="link" href={link[0]}>{t(link[1])}</a>.</> : null}</p>
          </details>
        ))}
      </div>
      <p className="t2" style={{ marginTop: 20 }}>{rich(t("Still stuck? <a>Write to us</a> and we will help."), { a: (c) => <a className="link" href="/contact">{c}</a> })}</p>
    </Page>
  );
}
