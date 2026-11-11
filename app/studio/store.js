"use client";
// All state and server calls for the studio. The screens only read from here and call these actions.
import { useCallback, useEffect, useRef, useState } from "react";
import { FORMATS } from "../../lib/formats";
import { prepareUpload, uploadRaw } from "../clientImage";
import { imageModel, imageModels, videoModel, videoModels, videoPlan, TOOLS, IMAGE_RATIOS, toItem, madeWith } from "./models";
import { setDownloadMark } from "./download";
import { posterUrl as posterUrlOf } from "../../lib/thumbs";

const json = (r) => r.json().catch(() => ({}));
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
const get = (url) => fetch(url, { cache: "no-store" });
const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Server messages are written in two languages ("English. / עברית."); this interface is English.
const plain = (msg) => (typeof msg === "string" ? msg.split(" / ")[0].replace(/⚡/g, " credits").trim() : "");
const dedupe = (list) => { const seen = new Set(); return list.filter((x) => !x.id || (!seen.has(x.id) && seen.add(x.id))); };
const store = {
  read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

export const FREE_DAILY = 10;
const SIGN_UP_REASON = `Sign up or sign in to create. You get ${FREE_DAILY} free credits every day.`;

export function useStudio() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("explore");
  const [mode, setMode] = useState("image");
  const [prompt, setPrompt] = useState("");
  const [imgModel, setImgModel] = useState("fast");
  const [vidModel, setVidModelRaw] = useState("veo-lite");
  const [ratio, setRatio] = useState("1:1");
  const [vDur, setVDur] = useState(null);
  const [vRes, setVRes] = useState(null);
  const [ref, setRef] = useState(null); // attached image: a reference (image mode) or the first frame (video mode)
  const [format, setFormat] = useState("free");
  const [wallet, setWallet] = useState({ loaded: false, free: 0, freeLimit: 3, guest: true, paid: 0, admin: false, account: null, plans: [], payments: false, purchased: false });
  const [runs, setRuns] = useState([]);
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [library, setLibrary] = useState("loading"); // loading | ready | off
  const [favs, setFavs] = useState(() => new Set());
  const [viewer, setViewer] = useState(null); // { item, before?, readonly? }
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState("");
  const [theme, setThemeRaw] = useState("dark");
  const [busyTool, setBusyTool] = useState("");
  const [uploading, setUploading] = useState(false);

  const walletRef = useRef(wallet); walletRef.current = wallet;
  const runsRef = useRef(runs); runsRef.current = runs;
  const toastTimer = useRef(null);
  const say = useCallback((msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3200); }, []);

  // ---- wallet ----
  const sync = useCallback((d) => {
    if (!d) return;
    setWallet((w) => ({ ...w, ...(d.admin ? { admin: true } : typeof d.credits === "number" ? { free: d.credits } : {}), ...(typeof d.paid === "number" ? { paid: d.paid } : {}) }));
  }, []);
  const refreshWallet = useCallback(async () => {
    const d = await get("/api/credits").then(json).catch(() => null);
    if (!d) return null;
    setWallet((w) => ({
      ...w, loaded: true, admin: Boolean(d.admin), account: d.account || null,
      free: typeof d.credits === "number" ? d.credits : w.free,
      freeLimit: typeof d.freeLimit === "number" ? d.freeLimit : d.account ? FREE_DAILY : w.freeLimit,
      guest: d.admin ? false : "guest" in d ? Boolean(d.guest) : !d.account,
      paid: typeof d.paid === "number" ? d.paid : w.paid,
      plans: Array.isArray(d.plans) ? d.plans : w.plans, payments: Boolean(d.payments), purchased: Boolean(d.purchased),
    }));
    return d;
  }, []);
  useEffect(() => { setDownloadMark(wallet.loaded && !wallet.admin && !wallet.purchased && wallet.paid === 0); }, [wallet]);

  // Where the person is and what they wrote, kept in the browser (not only in memory) whenever the sign-in screen
  // opens: signing in can leave this page (Google goes away and comes back, an emailed link may open a new tab),
  // and they must land exactly where they were, with their text. `after.tab` sends them somewhere else instead.
  const here = useRef({}); here.current = { tab, mode, prompt, ref };
  const afterSignIn = useRef(null);
  const askSignIn = useCallback((reason, after) => {
    const cur = here.current;
    afterSignIn.current = after?.tab || null;
    store.write("pp_draft", { tab: after?.tab || cur.tab, mode: cur.mode, prompt: cur.prompt, ref: cur.ref ? { id: cur.ref.id, url: cur.ref.url, ratio: cur.ref.ratio } : null, at: Date.now() });
    setSheet({ type: "signin", reason });
  }, []);
  // Creating needs an account. True when the visitor is a guest: the sign-in screen is opened and the action stops.
  const needAccount = useCallback((after) => {
    const w = walletRef.current;
    if (!w.loaded || w.admin || w.account) return false; // not loaded yet: the server decides
    askSignIn(SIGN_UP_REASON, after);
    return true;
  }, [askSignIn]);
  const askCredits = useCallback((need, label, paidOnly) => setSheet({ type: "pricing", need, label, paidOnly: Boolean(paidOnly) }), []);
  // True if the wallet covers it. Otherwise opens the right sheet: sign in (guest, small amount) or prices.
  const afford = useCallback((cost, { paidOnly, label } = {}) => {
    const w = walletRef.current;
    if (!w.loaded || w.admin) return true; // not loaded yet: the server decides
    if (w.paid >= cost || (!paidOnly && w.free >= cost)) return true; // the server pays from one pocket, never a mix
    if (!w.account) askSignIn(SIGN_UP_REASON);
    else askCredits(cost, label, paidOnly);
    return false;
  }, [askSignIn, askCredits]);
  const refused = useCallback((d, cost, label, paidOnly) => {
    if (d.needSignIn) askSignIn(plain(d.error));
    else askCredits(d.needCredits?.cost || cost, label, paidOnly || d.needCredits?.paidOnly);
  }, [askSignIn, askCredits]);

  // ---- library ----
  const addItem = useCallback((item) => { if (item?.id) setItems((prev) => [item, ...prev.filter((h) => h.id !== item.id)]); }, []);
  const loadLibrary = useCallback(async (more) => {
    const d = await get(`/api/history?limit=36${more ? `&cursor=${encodeURIComponent(more)}` : ""}`).then(json).catch(() => null);
    if (!d || d.error) { setLibrary((s) => (s === "loading" ? "ready" : s)); return []; }
    if (d.enabled === false) { setLibrary("off"); return []; }
    const got = (d.items || []).map(toItem);
    setItems((prev) => dedupe(more ? [...prev, ...got] : got));
    setCursor(d.nextCursor || null);
    setLibrary("ready");
    return got;
  }, []);
  const loadMore = useCallback(() => (cursor ? loadLibrary(cursor) : null), [cursor, loadLibrary]);

  const toggleFav = useCallback((item) => {
    if (!item?.id) return;
    setFavs((prev) => {
      const next = new Set(prev); const on = !next.has(item.id);
      if (on) next.add(item.id); else next.delete(item.id);
      store.write("pp_favs", [...next]);
      if (walletRef.current.account) post("/api/favorites", on ? { add: [item.id] } : { remove: [item.id] }).catch(() => {});
      return next;
    });
  }, []);

  // ---- runs (what the Create screen shows) ----
  const patchRun = useCallback((key, patch) => setRuns((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))), []);
  const dropRun = useCallback((key) => setRuns((rs) => rs.filter((r) => r.key !== key)), []);
  const markSeen = () => store.write("pp_seen", 1);

  // Returns true once the run is on screen; the request itself continues in the background.
  const startImage = useCallback((o) => {
    const m = imageModel(o.model);
    const cost = o.ref ? TOOLS.reference.cost : m.cost;
    const label = o.ref ? TOOLS.reference.label : m.name;
    if (!afford(cost, { label })) return false;
    const key = uid();
    setRuns((rs) => [...rs, { key, kind: "image", prompt: o.prompt, label, ratio: o.ratio, cost, status: "running", t0: Date.now(), eta: m.id === "fast" && !o.ref ? 6 : 20, poster: o.ref?.url, again: { ...o, kind: "image" } }]);
    markSeen();
    (async () => {
      try {
        const res = await post("/api/generate", { prompt: o.prompt, style: "None", aspectRatio: o.ratio, tier: m.id, format: o.format || "free", ...(o.ref ? { guideId: o.ref.id, guideFollow: 0.55 } : {}) });
        const d = await json(res); sync(d);
        if (res.status === 402 || res.status === 401) { dropRun(key); refused(d, cost, label); return; }
        if (!res.ok || d.error || !d.imageUrl) throw new Error(plain(d.error) || "The image didn't finish. Any credits were returned.");
        const item = toItem({ id: d.id, public_url: d.imageUrl, prompt: o.prompt, aspect_ratio: o.ratio, model: o.ref ? "guided" : d.tier || m.id });
        if (d.stored) addItem(item);
        patchRun(key, { status: "done", item, unsaved: !d.stored });
      } catch (e) { patchRun(key, { status: "failed", error: e.message || "Something went wrong. Any credits were returned." }); }
    })();
    return true;
  }, [afford, refused, sync, addItem, patchRun, dropRun]);

  const pollJob = useCallback(async (key, job) => {
    const started = Date.now();
    while (Date.now() - started < 20 * 60_000) {
      await sleep(4000);
      const s = await get(`/api/animate?job=${encodeURIComponent(job)}`).then(json).catch(() => ({ status: "processing" }));
      if (s.status === "processing") continue;
      sync(s);
      if (s.status === "done" && s.item) { const item = toItem(s.item); addItem(item); patchRun(key, { status: "done", item }); say("Your video is ready"); return; }
      throw new Error(plain(s.error) || "The video didn't finish. Your credits were returned.");
    }
    patchRun(key, { status: "late" });
  }, [sync, addItem, patchRun, say]);

  const startVideo = useCallback((o) => {
    // o.source: animate an existing image (fixed model). Otherwise text-to-video on the chosen model.
    const m = videoModel(o.model);
    const plan = o.source ? null : videoPlan(m.id, o.d, o.r, o.ratio);
    if (!o.source && !plan) { say("That length and quality aren't available on this model."); return false; }
    const cost = o.source ? TOOLS.animate.cost : plan.cost;
    const label = o.source ? `${TOOLS.animate.label}, ${TOOLS.animate.detail}` : `${m.name}, ${plan.d} s, ${plan.r}`;
    if (!afford(cost, { paidOnly: true, label: o.source ? TOOLS.animate.label : m.name })) return false;
    const key = uid();
    setRuns((rs) => [...rs, { key, kind: "video", prompt: o.prompt, label, ratio: o.source ? o.source.ratio || "1:1" : plan.ratio, cost, status: "running", t0: Date.now(), eta: o.source ? 75 : Math.round(m.eta * (plan.d > 6 ? 1.6 : 1)), poster: o.source?.url, again: { ...o, kind: "video" } }]);
    markSeen();
    (async () => {
      try {
        const res = await post("/api/animate", o.source ? { id: o.source.id, ...(o.prompt ? { prompt: o.prompt } : {}) } : { model: m.id, prompt: o.prompt, aspectRatio: plan.ratio, duration: plan.d, resolution: plan.r });
        const d = await json(res); sync(d);
        if (res.status === 402 || res.status === 401) { dropRun(key); refused(d, cost, label, true); return; }
        if (!res.ok || !d.job) throw new Error(plain(d.error) || "The video couldn't start. Your credits were returned.");
        await pollJob(key, d.job);
      } catch (e) { patchRun(key, { status: "failed", error: e.message || "The video didn't finish. Your credits were returned." }); }
    })();
    return true;
  }, [afford, refused, sync, patchRun, dropRun, pollJob, say]);

  const retry = useCallback((run) => { dropRun(run.key); if (run.again?.kind === "video") startVideo(run.again); else if (run.again) startImage(run.again); }, [dropRun, startVideo, startImage]);

  // The Generate button.
  const generate = useCallback(() => {
    if (needAccount({ tab: "create" })) return;
    const text = prompt.trim();
    if (mode === "video") {
      if (ref) { if (startVideo({ source: ref, prompt: text })) { setPrompt(""); setRef(null); } return; }
      if (!text) { say("Describe the video first."); return; }
      if (startVideo({ model: vidModel, prompt: text, ratio, d: vDur, r: vRes })) setPrompt("");
      return;
    }
    if (!text) { say("Describe the image first."); return; }
    if (startImage({ model: imgModel, prompt: text, ratio, ref, format })) setPrompt("");
  }, [prompt, mode, ref, vidModel, ratio, vDur, vRes, imgModel, format, startVideo, startImage, say, needAccount]);

  // ---- tools on an existing image ----
  const runTool = useCallback(async (tool, item, extra = {}) => {
    const t = TOOLS[tool];
    if (needAccount()) return;
    if (!item?.id) { say("This image wasn't saved, so it can't be changed."); return; }
    if (busyTool) return;
    if (!afford(t.cost, { paidOnly: t.paidOnly, label: t.label })) return;
    setBusyTool(tool);
    try {
      const res = await post(`/api/${tool}`, { id: item.id, ...extra });
      const d = await json(res); sync(d);
      if (res.status === 402 || res.status === 401) { refused(d, t.cost, t.label, t.paidOnly); return; }
      if (!res.ok || !d.item) throw new Error(plain(d.error) || `${t.label} didn't finish. Any credits were returned.`);
      const made = toItem(d.item);
      addItem(made);
      setViewer({ item: made, before: item });
      say(t.done);
    } catch (e) { say(e.message); }
    finally { setBusyTool(""); }
  }, [busyTool, afford, refused, sync, addItem, say, needAccount]);

  const animate = useCallback((item) => {
    if (needAccount()) return;
    if (!item?.id) { say("This image wasn't saved, so it can't be animated."); return; }
    setViewer(null); setTab("create"); setMode("video");
    startVideo({ source: item, prompt: "" });
  }, [startVideo, say, needAccount]);

  const variations = useCallback((item) => {
    if (needAccount()) return;
    const m = imageModels.some((x) => x.id === item.model) ? item.model : "fast";
    setViewer(null); setTab("create"); setMode("image");
    startImage({ model: m, prompt: item.prompt, ratio: IMAGE_RATIOS.some((r) => r.id === item.ratio) ? item.ratio : "1:1" });
  }, [startImage, needAccount]);

  const useAgain = useCallback((item) => {
    setPrompt(item.prompt || "");
    if (item.video) { setMode("video"); const v = String(item.model || "").startsWith("video:") ? item.model.slice(6) : null; if (v && videoModels.some((x) => x.id === v)) setVidModelRaw(v); }
    else { setMode("image"); if (imageModels.some((x) => x.id === item.model)) setImgModel(item.model); }
    if (IMAGE_RATIOS.some((r) => r.id === item.ratio)) setRatio(item.ratio);
    setViewer(null); setTab("create");
  }, []);

  const remove = useCallback(async (item) => {
    if (!item?.id) { setRuns((rs) => rs.filter((r) => r.item !== item)); setViewer(null); return; }
    const res = await post("/api/delete", { ids: [item.id] }).catch(() => null);
    if (!res || !res.ok) { say("Couldn't delete. Try again."); return; }
    setItems((prev) => prev.filter((h) => h.id !== item.id));
    setRuns((rs) => rs.filter((r) => r.item?.id !== item.id));
    setViewer(null); say("Deleted");
  }, [say]);

  // Put a changed copy of an item (for example a converted video with a new address) everywhere it is shown.
  const swapItem = useCallback((item) => {
    if (!item?.id) return;
    setItems((prev) => prev.map((h) => (h.id === item.id ? { ...h, ...item } : h)));
    setRuns((rs) => rs.map((r) => (r.item?.id === item.id ? { ...r, item: { ...r.item, ...item } } : r)));
    setViewer((v) => (v?.item?.id === item.id ? { ...v, item: { ...v.item, ...item } } : v));
  }, []);

  // A player could not play a video. That says nothing about the file itself (the phone may simply not support
  // its format), so the page never treats it as a failed video. It tells the server, which reads the stored file:
  //   - a real video is converted to the format every phone plays, and the page gets its new address;
  //   - only a file that is missing or is not a video at all is removed and refunded.
  // Returns "converted" | "removed" | "format" (fine file, could not be converted) | "device" (fine file).
  const reports = useRef(new Map());
  const reportVideo = useCallback(async (item, err) => {
    if (!item?.id || !item.video) return "device";
    const n = reports.current.get(item.id) || 0;
    if (n >= 2) return "device"; // tried a conversion and a full re-make already
    reports.current.set(item.id, n + 1);
    const res = await post("/api/video/check", { id: item.id, code: err?.code, message: err?.message, again: n > 0 }).catch(() => null);
    const d = res ? await json(res) : {};
    if (res?.ok && d.converted && d.item) { swapItem(toItem(d.item)); return "converted"; }
    if (res?.ok && d.removed) {
      sync(d);
      setItems((prev) => prev.filter((h) => h.id !== item.id));
      setRuns((rs) => rs.filter((r) => r.item?.id !== item.id));
      setViewer((v) => (v?.item?.id === item.id ? null : v));
      say(d.refunded ? `That video's file was missing or damaged. It was removed and ${d.refunded} credits were returned.` : "That video's file was missing or damaged, so it was removed.");
      return "removed";
    }
    return res?.ok && d.playable === false ? "format" : "device";
  }, [sync, say, swapItem]);

  // The first time the owner plays a video, one frame is saved as its picture for lists.
  const [posters, setPosters] = useState({});
  const posterTried = useRef(new Set());
  const savePoster = useCallback(async (item, el) => {
    if (!item?.id || !el || posterTried.current.has(item.id)) return;
    posterTried.current.add(item.id);
    try {
      const at = posterUrlOf(item.url); if (!at) return;
      const have = await fetch(at, { method: "HEAD", cache: "no-store" }).then((r) => r.ok, () => false);
      if (have) return;
      const w = el.videoWidth, h = el.videoHeight; if (!w || !h) return;
      const k = Math.min(1, 480 / w);
      const c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext("2d").drawImage(el, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.8); // throws if the browser did not allow reading the frame
      if (data.length < 2000) return;
      const res = await post("/api/video/poster", { id: item.id, data });
      if (res.ok) setPosters((p) => ({ ...p, [item.id]: Date.now() }));
    } catch {}
  }, []);

  const uploadLock = useRef(false);
  const upload = useCallback(async (file) => {
    if (needAccount()) return;
    if (!file || uploadLock.current) return;
    uploadLock.current = true; setUploading(true);
    const uploadId = crypto.randomUUID ? crypto.randomUUID() : `${uid()}${uid()}`;
    try {
      const prep = await prepareUpload(file);
      const res = prep.data
        ? await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json", "x-upload-id": uploadId }, body: JSON.stringify({ data: prep.data }) })
        : await uploadRaw(prep.raw, uploadId);
      const d = await json(res);
      if (res.status === 401 && d.needSignIn) { askSignIn(plain(d.error)); return; }
      if (!res.ok || !d.item) throw new Error(plain(d.error) || (res.status === 413 ? "That photo is too large. Try a smaller one." : "The upload didn't work. Try again."));
      const item = toItem(d.item);
      addItem(item); setRef(item); setTab("create");
    } catch (e) { say(e.message || "The upload didn't work. Try again."); }
    finally { setUploading(false); uploadLock.current = false; }
  }, [addItem, say, needAccount, askSignIn]);

  // ---- account ----
  const signedIn = useCallback(async () => {
    setSheet(null);
    if (afterSignIn.current) { setTab(afterSignIn.current); afterSignIn.current = null; }
    store.write("pp_draft", null);
    await refreshWallet(); loadLibrary(); say("You're signed in");
  }, [refreshWallet, loadLibrary, say]);
  const signOut = useCallback(async () => { await post("/api/auth/signout").catch(() => {}); window.location.href = "/"; }, []);
  const buy = useCallback(async (planId) => {
    const res = await post("/api/checkout", { plan: planId }).catch(() => null);
    const d = res ? await json(res) : {};
    if (res?.ok && d.url) { window.location.href = d.url; return; }
    say(plain(d.error) || "Checkout isn't available right now.");
  }, [say]);

  const setVidModel = useCallback((id) => { setVidModelRaw(id); setVDur(null); setVRes(null); }, []);
  const setTheme = useCallback((t) => { setThemeRaw(t); }, []);

  // ---- remember choices ----
  useEffect(() => { if (ready) store.write("pp_studio", { mode, imgModel, vidModel, ratio, theme }); }, [ready, mode, imgModel, vidModel, ratio, theme]);

  // ---- videos that were still rendering when the page was last closed ----
  const checkPending = useCallback(async () => {
    const d = await get("/api/animate?pending=1").then(json).catch(() => null);
    if (!d || !Array.isArray(d.jobs)) return null;
    sync(d);
    if (Array.isArray(d.repaired)) d.repaired.forEach((r) => swapItem(toItem(r))); // old videos converted on this visit
    return d.jobs;
  }, [sync, swapItem]);
  const hasResumed = runs.some((r) => r.resumed && r.status === "running");
  useEffect(() => {
    if (!hasResumed) return;
    const t = setInterval(async () => {
      const jobs = await checkPending();
      if (!jobs) return;
      let reload = false;
      for (const r of runsRef.current.filter((x) => x.resumed && x.status === "running")) {
        const j = jobs.find((x) => x.id === r.jobId);
        if (j && j.status === "processing") continue;
        if (j && j.status === "failed") patchRun(r.key, { status: "failed", error: plain(j.error) || "The video didn't finish. Your credits were returned." });
        else if (j?.item) { const item = toItem(j.item); addItem(item); patchRun(r.key, { status: "done", item }); }
        else { dropRun(r.key); reload = true; }
      }
      if (reload) { await loadLibrary(); say("Your video is ready in Library"); }
    }, 8000);
    return () => clearInterval(t);
  }, [hasResumed, checkPending, addItem, patchRun, dropRun, loadLibrary, say]);

  // ---- first load ----
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = store.read("pp_studio", {});
    if (p.mode === "video") setMode("video");
    if (imageModels.some((m) => m.id === p.imgModel)) setImgModel(p.imgModel);
    if (videoModels.some((m) => m.id === p.vidModel)) setVidModelRaw(p.vidModel);
    if (IMAGE_RATIOS.some((r) => r.id === p.ratio)) setRatio(p.ratio);
    if (["dark", "light", "auto"].includes(p.theme)) setThemeRaw(p.theme);
    setFavs(new Set(store.read("pp_favs", [])));

    let start = store.read("pp_seen", 0) ? "create" : "explore";
    const t = q.get("tab");
    if (t === "me") start = "library"; else if (t === "community") start = "explore"; else if (t === "create") start = "create";
    const f = q.get("format");
    if (f && FORMATS[f] && f !== "free") {
      setFormat(f); setMode("image"); start = "create";
      if (FORMATS[f].ratio && IMAGE_RATIOS.some((r) => r.id === FORMATS[f].ratio)) setRatio(FORMATS[f].ratio);
      if (FORMATS[f].engine && imageModels.some((m) => m.id === FORMATS[f].engine)) setImgModel(FORMATS[f].engine);
    }
    if (q.get("p")) { setPrompt(q.get("p").slice(0, 1500)); setMode("image"); start = "create"; }
    if (q.get("vibe")) {
      start = "create";
      if (IMAGE_RATIOS.some((r) => r.id === q.get("ratio"))) setRatio(q.get("ratio"));
      if (imageModels.some((m) => m.id === q.get("tier"))) setImgModel(q.get("tier"));
    }
    if (q.get("signedin") === "1") {
      start = store.read("pp_seen", 0) ? "create" : "explore";
      // Back from Google or from the emailed link: put the person where they were, with what they wrote.
      const d = store.read("pp_draft", null);
      if (d && Date.now() - (Number(d.at) || 0) < 60 * 60_000) {
        if (["explore", "create", "library", "account"].includes(d.tab)) start = d.tab;
        if (d.mode === "video" || d.mode === "image") setMode(d.mode);
        if (typeof d.prompt === "string" && d.prompt) setPrompt(d.prompt.slice(0, 1500));
        if (d.ref?.id && typeof d.ref.url === "string") setRef(toItem({ id: d.ref.id, public_url: d.ref.url, aspect_ratio: d.ref.ratio }));
      }
      store.write("pp_draft", null);
      setTimeout(() => say("You're signed in"), 300);
    }
    if (q.get("signin") === "1") setTimeout(() => askSignIn(), 200);
    if (q.get("paid") === "1") {
      setTimeout(() => say("Thank you. Your credits are on the way."), 300);
      [3000, 8000, 20000].forEach((ms) => setTimeout(refreshWallet, ms));
      setTimeout(async () => { const d = await refreshWallet(); if (d && !d.account && !d.admin) askSignIn("Purchase complete. Sign in so your credits are safe on every device."); }, 2500);
    }
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    setTab(start); setReady(true);

    refreshWallet().then((d) => {
      if (d?.account) get("/api/favorites").then(json).then((fv) => { if (fv.cloud && Array.isArray(fv.ids)) setFavs((prev) => new Set([...prev, ...fv.ids])); }).catch(() => {});
    });
    (async () => {
      await post("/api/session").catch(() => {});
      const jobs = (await checkPending()) || [];
      const got = await loadLibrary();
      const waiting = jobs.filter((j) => j.status === "processing").map((j) => ({
        key: `j${j.id}`, jobId: j.id, resumed: true, kind: "video", prompt: j.prompt || "", label: madeWith(j.kind), ratio: "16:9",
        status: "running", t0: Date.parse(j.started) || Date.now(), eta: 150,
      }));
      // A video that ended badly while the page was closed: say so (the credits are already back).
      const ended = jobs.filter((j) => j.status === "failed").map((j) => ({
        key: `j${j.id}`, kind: "video", prompt: j.prompt || "", label: madeWith(j.kind), ratio: "16:9", status: "failed",
        error: plain(j.error) || "The video didn't finish. Your credits were returned.",
      }));
      const past = got.slice(0, 6).reverse().map((item) => ({ key: `h${item.id}`, kind: item.video ? "video" : "image", prompt: item.prompt, label: madeWith(item.model), ratio: item.ratio, status: "done", item, past: true }));
      setRuns((rs) => [...past, ...ended, ...waiting, ...rs]);
    })();
  }, []);

  return {
    ready, tab, setTab, mode, setMode, prompt, setPrompt, imgModel, setImgModel, vidModel, setVidModel, ratio, setRatio,
    vDur, setVDur, vRes, setVRes, ref, setRef, format, setFormat, wallet, runs, items, cursor, library, favs,
    viewer, setViewer, sheet, setSheet, toast, say, theme, setTheme, busyTool, uploading,
    generate, retry, dropRun, runTool, animate, variations, useAgain, remove, upload, toggleFav, loadMore, reportVideo, savePoster, posters,
    askSignIn, needAccount, askCredits, signedIn, signOut, buy, refreshWallet,
  };
}
