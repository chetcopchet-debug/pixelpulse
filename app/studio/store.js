"use client";
import { t, N, sm, isLang, pickLang, loadDict, applyDict, langTag, LANG_COOKIE } from "../i18n/index.js";
// All state and server calls for the studio. The screens only read from here and call these actions.
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { FORMATS } from "../../lib/formats";
import { autoPick } from "./auto";
import { prepareUpload, uploadRaw } from "../clientImage";
import { imageModel, imageModels, videoModel, videoModels, videoPlan, videoTakesImage, comparePlan, covers, TOOLS, IMAGE_RATIOS, toItem, madeWith, answers } from "./models";
import { setDownloadMark } from "./download";
import { posterUrl as posterUrlOf } from "../../lib/thumbs";

const json = (r) => r.json().catch(() => ({}));
const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
const get = (url) => fetch(url, { cache: "no-store" });
const uid = () => Math.random().toString(36).slice(2, 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Server messages are written in two languages ("English. / עברית."); this interface is English.
// A message from the server arrives in English and is shown in the visitor's language.
const plain = (msg) => (typeof msg === "string" ? sm(msg.split(" / ")[0].replace(/⚡/g, " credits").trim()) : "");
const dedupe = (list) => { const seen = new Set(); return list.filter((x) => !x.id || (!seen.has(x.id) && seen.add(x.id))); };
const store = {
  read(key, fallback) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v ?? fallback; } catch { return fallback; } },
  write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

// What this device remembers about a run: enough to draw it again and to find its result in the Library.
const slimItem = (x) => (x?.id ? { id: x.id, url: x.url, prompt: x.prompt, ratio: x.ratio, model: x.model, at: x.at, video: x.video, project: x.project } : null);
const slimRun = (r) => ({ key: r.key, kind: r.kind, model: r.model, prompt: r.prompt, label: r.label, ratio: r.ratio, cost: r.cost, status: r.status, t0: r.t0, eta: r.eta, doneAt: r.doneAt, skip: r.skip, item: slimItem(r.item),
  ...(r.parts ? { parts: r.parts.map((p) => ({ id: p.id, name: p.name, cost: p.cost, status: p.status, t0: p.t0, eta: p.eta, doneAt: p.doneAt, error: p.error, item: slimItem(p.item) })) } : {}) });
const okItem = (x) => x && typeof x.id === "string" && typeof x.url === "string";
// The Create screen needs only what is in progress, what failed, and the last few results.
const trim = (rs) => { const done = rs.filter((r) => r.status === "done"); const old = new Set(done.slice(0, Math.max(0, done.length - 4)).map((r) => r.key)); return rs.filter((r) => !old.has(r.key)); };
const LOST_MSG = N("This one didn't come back. If it was made, it is in your Library. If it failed, its credits were returned.");

export const BUILD = process.env.NEXT_PUBLIC_BUILD || "dev"; // which build this page is
export const FREE_DAILY = 10;
const SIGN_UP_REASON = N("Sign up or sign in to create. You get {n} free credits every day.");

export function useStudio() {
  const [ready, setReady] = useState(false);
  const [tab, setTabRaw] = useState("explore");
  const tabRef = useRef("explore");
  // The Create screen opens clean every time: a result is on it only right after it was made, while the
  // person stays there. Whatever is still being made (or failed) stays.
  const setTab = useCallback((t) => {
    if (t === "create" && tabRef.current !== "create") setRuns((rs) => rs.filter((r) => r.status !== "done"));
    tabRef.current = t; setTabRaw(t);
  }, []);
  const [mode, setMode] = useState("image");
  const [prompt, setPrompt] = useState("");
  const [imgModel, setImgModelRaw] = useState("fast");
  const [auto, setAutoRaw] = useState(false); // Auto: the model is chosen from the prompt (images only)
  const [improve, setImprove] = useState(true); // a short idea is filled in before it is made (the server does it)
  const [polish, setPolish] = useState(null); // { original }: the box holds a prompt the improve button wrote; Undo puts the person's own words back
  const [improving, setImproving] = useState(false);
  const [vidModel, setVidModelRaw] = useState("h3-lite");
  const [compare, setCompare] = useState([]); // image model ids to run side by side; fewer than two means "one model"
  // The three ways to choose are exclusive: one model, Auto, or comparing several.
  const setImgModel = useCallback((id) => { setAutoRaw(false); setCompare([]); setImgModelRaw(id); }, []);
  const setAuto = useCallback((on) => { if (on) setCompare([]); setAutoRaw(Boolean(on)); }, []);
  const [ratio, setRatio] = useState("1:1");
  const [vDur, setVDur] = useState(null);
  const [vRes, setVRes] = useState(null);
  const [ref, setRef] = useState(null); // attached image: a reference (image mode) or the first frame (video mode)
  const [format, setFormat] = useState("free");
  const [wallet, setWallet] = useState({ loaded: false, free: 0, freeLimit: 3, guest: true, paid: 0, admin: false, account: null, plans: [], payments: false, purchased: false });
  const [runs, setRuns] = useState([]);
  const [items, setItems] = useState([]);
  const itemsRef = useRef([]); itemsRef.current = items;
  // Projects: folders in the Library. `project` is the one being worked in: the Library shows its items and new
  // creations are saved into it. null = everything.
  const [projects, setProjects] = useState([]);
  const [projectsOn, setProjectsOn] = useState(false);
  const [project, setProjectRaw] = useState(null);
  const projectRef = useRef(null);
  const libSeq = useRef(0);
  const [cursor, setCursor] = useState(null);
  const [library, setLibrary] = useState("loading"); // loading | ready | off
  const [favs, setFavs] = useState(() => new Set());
  const [viewer, setViewer] = useState(null); // { item, before?, readonly? }
  const [sheet, setSheet] = useState(null);
  const [area, setArea] = useState(null); // the image whose marked part is being changed
  const [toast, setToast] = useState("");
  const [newer, setNewer] = useState(false); // the site has a newer build than the page on screen
  const [theme, setThemeRaw] = useState("dark");
  // The language of the interface. It is chosen once from the browser's own language, and changed in Settings
  // (or at the bottom of Explore for a visitor). The choice is kept in a cookie, so pages the server draws use it too.
  const [lang, setLangRaw] = useState("en");
  const setLang = useCallback(async (id) => {
    const next = isLang(id) ? id : "en";
    const dict = await loadDict(next).catch(() => null);
    const use = dict || next === "en" ? next : "en"; // a language file that did not arrive leaves English
    applyDict(use, dict);
    try { document.cookie = `${LANG_COOKIE}=${use}; path=/; max-age=31536000; samesite=lax`; localStorage.setItem(LANG_COOKIE, use); } catch { /* private mode */ }
    document.documentElement.lang = langTag();
    setLangRaw(use);
  }, []);
  // A full page over the tabs: "settings", "pricing", "help". null = none.
  const [page, setPage] = useState(null);
  // The Explore gallery: the pictures the site's owner chose to show.
  const [explore, setExplore] = useState({ status: "loading", items: [] });
  const loadExplore = useCallback(async () => {
    const d = await get("/api/explore").then(json).catch(() => null);
    setExplore({ status: "ready", items: Array.isArray(d?.items) ? d.items.map(toItem).filter((x) => x.id && x.url) : [] });
  }, []);
  const [busyTool, setBusyTool] = useState("");
  const [uploading, setUploading] = useState(false);

  const walletRef = useRef(wallet); walletRef.current = wallet;
  // Models that are down right now (the server tells us). They stay in the lists, marked "Temporarily unavailable",
  // and are never chosen: not by a tap, not by Auto, and a saved choice of one moves to a model that works.
  const off = useMemo(() => new Set(wallet.off || []), [wallet.off]);
  useEffect(() => {
    if (!off.size) return;
    if (off.has(imgModel)) setImgModelRaw((imageModels.find((m) => m.id === "fast" && !off.has(m.id)) || imageModels.find((m) => !off.has(m.id)) || { id: "fast" }).id);
    if (off.has(vidModel)) setVidModelRaw((videoModels.find((m) => m.id === "h3-lite" && !off.has(m.id)) || videoModels.find((m) => !off.has(m.id)) || { id: "h3-lite" }).id);
    if (compare.some((id) => off.has(id))) setCompare(compare.filter((id) => !off.has(id)));
  }, [off, imgModel, vidModel, compare]);
  const runsRef = useRef(runs); runsRef.current = runs;
  const toastTimer = useRef(null);
  const say = useCallback((msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(""), 3200); }, []);

  // ---- wallet ----
  const sync = useCallback((d) => {
    if (!d) return;
    if (d.modelOff) setWallet((w) => ({ ...w, off: [...new Set([...(w.off || []), d.modelOff])] })); // the server just learned this model is gone
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
      off: Array.isArray(d.off) ? d.off : w.off,
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
    askSignIn(t(SIGN_UP_REASON, { n: FREE_DAILY }), after);
    return true;
  }, [askSignIn]);
  const askCredits = useCallback((need, label, paidOnly) => setSheet({ type: "pricing", need, label, paidOnly: Boolean(paidOnly) }), []);
  // True if the wallet covers it. Otherwise opens the right sheet: sign in (guest, small amount) or prices.
  const afford = useCallback((cost, { paidOnly, label } = {}) => {
    const w = walletRef.current;
    if (!w.loaded || w.admin) return true; // not loaded yet: the server decides
    if (w.paid >= cost || (!paidOnly && w.free >= cost)) return true; // the server pays from one pocket, never a mix
    if (!w.account) askSignIn(t(SIGN_UP_REASON, { n: FREE_DAILY }));
    else askCredits(cost, label, paidOnly);
    return false;
  }, [askSignIn, askCredits]);
  const refused = useCallback((d, cost, label, paidOnly) => {
    if (d.needSignIn) askSignIn(plain(d.error));
    else askCredits(d.needCredits?.cost || cost, label, paidOnly || d.needCredits?.paidOnly);
  }, [askSignIn, askCredits]);

  // ---- library ----
  // A new item goes to the top of the Library, and into the project being worked in.
  // `keep`: the server already decided the item's project (a video is filed where it was started), so it is
  // not moved into the project that happens to be open now.
  const addItem = useCallback((item, { keep = false } = {}) => {
    if (!item?.id) return;
    const pid = projectRef.current;
    if (keep) {
      if (item.project) setProjects((ps) => ps.map((p) => (p.id === item.project ? { ...p, count: p.count + 1 } : p)));
      if (pid && item.project !== pid) return; // another project is open: it isn't part of this list
      setItems((prev) => [item, ...prev.filter((h) => h.id !== item.id)]);
      return;
    }
    const it = pid && !item.project ? { ...item, project: pid } : item;
    if (it !== item) {
      post("/api/projects/items", { project: pid, ids: [item.id] }).catch(() => {});
      setProjects((ps) => ps.map((p) => (p.id === pid ? { ...p, count: p.count + 1, cover: p.cover || (it.video ? null : it.url) } : p)));
    }
    setItems((prev) => [it, ...prev.filter((h) => h.id !== it.id)]);
  }, []);
  const loadLibrary = useCallback(async (more) => {
    const seq = more ? libSeq.current : ++libSeq.current; // a newer load (another project) makes this answer stale
    const pid = projectRef.current;
    const d = await get(`/api/history?limit=36${more ? `&cursor=${encodeURIComponent(more)}` : ""}${pid ? `&project=${pid}` : ""}`).then(json).catch(() => null);
    if (seq !== libSeq.current) return [];
    if (!d || d.error) { setLibrary((s) => (s === "loading" ? "ready" : s)); return []; }
    if (d.enabled === false) { setLibrary("off"); return []; }
    const got = (d.items || []).map(toItem);
    setItems((prev) => dedupe(more ? [...prev, ...got] : got));
    setCursor(d.nextCursor || null);
    setLibrary("ready");
    return got;
  }, []);
  const loadMore = useCallback(() => (cursor ? loadLibrary(cursor) : null), [cursor, loadLibrary]);

  // ---- projects ----
  const setProject = useCallback((id) => {
    const next = id || null;
    if (next === projectRef.current) return;
    projectRef.current = next; setProjectRaw(next);
    setItems([]); setCursor(null); setLibrary("loading"); loadLibrary();
  }, [loadLibrary]);
  const loadProjects = useCallback(async () => {
    const d = await get("/api/projects").then(json).catch(() => null);
    if (!d || d.error) return null;
    const on = d.enabled !== false, list = on ? d.projects || [] : [];
    setProjectsOn(on); setProjects(list);
    if (projectRef.current && !list.some((p) => p.id === projectRef.current)) setProject(null); // the remembered project is gone
    return list;
  }, [setProject]);
  const projectCall = useCallback(async (body) => {
    const res = await post("/api/projects", body).catch(() => null);
    const d = res ? await json(res) : {};
    if (!res?.ok) { say(plain(d.error) || t("That didn't work. Try again.")); return null; }
    return d;
  }, [say]);
  const createProject = useCallback(async (name) => {
    const d = await projectCall({ action: "create", name });
    if (!d?.project) return null;
    setProjects((ps) => [d.project, ...ps]);
    return d.project;
  }, [projectCall]);
  const renameProject = useCallback(async (id, name) => {
    const d = await projectCall({ action: "rename", id, name });
    if (!d?.project) return false;
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name: d.project.name } : p)));
    return true;
  }, [projectCall]);
  // Deleting a project keeps its images and videos. They only stop belonging to it.
  const deleteProject = useCallback(async (id) => {
    const d = await projectCall({ action: "delete", id });
    if (!d) return false;
    setProjects((ps) => ps.filter((p) => p.id !== id));
    if (projectRef.current === id) setProject(null); else setItems((prev) => prev.map((h) => (h.project === id ? { ...h, project: null } : h)));
    say(t("Project deleted. Its items are still in your Library."));
    return true;
  }, [projectCall, setProject, say]);
  const moveItem = useCallback(async (item, pid) => {
    if (!item?.id) return false;
    const to = pid || null;
    const res = await post("/api/projects/items", { project: to, ids: [item.id] }).catch(() => null);
    const d = res ? await json(res) : {};
    if (!res?.ok) { say(plain(d.error) || t("Couldn't move it. Try again.")); return false; }
    const open = projectRef.current;
    setItems((prev) => (open && open !== to ? prev.filter((h) => h.id !== item.id) : prev.map((h) => (h.id === item.id ? { ...h, project: to } : h))));
    setViewer((v) => (v?.item?.id === item.id ? { ...v, item: { ...v.item, project: to } } : v));
    loadProjects();
    say(to ? t("Added to the project") : t("Taken out of the project"));
    return true;
  }, [say, loadProjects]);

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

  // The project that is open now, as a field for a request. The server files the result there itself, so it is
  // in the right project even if the page is closed before the result comes back.
  const inProject = () => (projectRef.current ? { project: projectRef.current } : {});

  // ---- runs (what the Create screen shows) ----
  const patchRun = useCallback((key, patch) => setRuns((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r))), []);
  const dropRun = useCallback((key) => setRuns((rs) => rs.filter((r) => r.key !== key)), []);
  const markSeen = () => store.write("pp_seen", 1);
  // Was the person away from the Create screen when this finished? Away means: on another screen of the site,
  // the page hidden (phone locked, another app in front), or only just back. `since` is the last moment we know
  // the creation was still running. A result that finished while away goes to the Library only.
  const backAt = useRef(0), beat = useRef(Date.now()), note = useRef("");
  useEffect(() => { const timer = setInterval(() => { beat.current = Date.now(); }, 1000); return () => clearInterval(timer); }, []);
  const awaySince = useCallback((since) => tabRef.current !== "create" || document.visibilityState !== "visible" || backAt.current > since || Date.now() - beat.current > 3500, []);
  const tell = useCallback((msg) => { if (document.visibilityState === "visible") say(msg); else note.current = msg; }, [say]);
  useEffect(() => {
    const gone = runs.filter((r) => r.status === "done" && r.away);
    if (!gone.length) return;
    setRuns((rs) => rs.filter((r) => !(r.status === "done" && r.away)));
    const k = gone[gone.length - 1].kind;
    tell(k === "video" ? t("Your video is ready in your Library") : k === "compare" ? t("Your comparison is ready in your Library") : t("Your image is ready in your Library"));
  }, [runs, tell]);

  // Returns true once the run is on screen; the request itself continues in the background.
  const startImage = useCallback((o) => {
    const m = imageModel(o.model);
    const cost = o.ref ? TOOLS.reference.cost : m.cost;
    const label = o.ref ? TOOLS.reference.label : o.auto ? `${m.name}, picked by Auto` : m.name;
    if (!afford(cost, { label: o.ref ? TOOLS.reference.label : m.name })) return false;
    const key = uid();
    setRuns((rs) => [...trim(rs), { key, kind: "image", model: o.ref ? "guided" : m.id, prompt: o.prompt, label, ratio: o.ratio, cost, status: "running", t0: Date.now(), eta: m.id === "fast" && !o.ref ? 6 : 20, poster: o.ref?.url,
      skip: itemsRef.current.slice(0, 12).map((x) => x.id), again: { ...o, kind: "image" } }]);
    markSeen();
    (async () => {
      let res;
      // No answer at all (the phone put the browser to sleep, the network dropped, the page was closed): the
      // server usually finished anyway, so look for the result in the Library instead of calling it a failure.
      try { res = await post("/api/generate", { prompt: o.prompt, style: "None", aspectRatio: o.ratio, tier: m.id, format: o.format || "free", ...(o.ref ? { guideId: o.ref.id, guideFollow: 0.55 } : {}), ...(o.improve && !o.ref ? { improve: true } : {}), ...inProject() }); }
      catch { patchRun(key, { lost: true }); watchRef.current(); return; }
      try {
        const d = await json(res); sync(d);
        if (res.status === 402 || res.status === 401) { dropRun(key); refused(d, cost, label); return; }
        if (!res.ok || d.error || !d.imageUrl) throw new Error(plain(d.error) || t("The image didn't finish. Any credits were returned."));
        const item = toItem({ id: d.id, public_url: d.imageUrl, prompt: o.prompt, aspect_ratio: o.ratio, model: o.ref ? "guided" : d.tier || m.id, project_id: d.project });
        if (d.stored) addItem(item, { keep: "project" in d });
        patchRun(key, { status: "done", item, unsaved: !d.stored, doneAt: Date.now(), lost: false, away: Boolean(d.stored) && awaySince(Date.now() - 1500), ...(typeof d.usedPrompt === "string" ? { used: d.usedPrompt } : {}) });
      } catch (e) { patchRun(key, { status: "failed", error: e.message || t("Something went wrong. Any credits were returned.") }); }
    })();
    return true;
  }, [afford, refused, sync, addItem, patchRun, dropRun, awaySince]);

  // ---- comparing models: one prompt, one image from each ----
  const patchPart = useCallback((key, id, patch) => setRuns((rs) => rs.map((r) => {
    if (r.key !== key || !r.parts) return r;
    const parts = r.parts.map((p) => (p.id === id ? { ...p, ...patch } : p));
    const running = parts.some((p) => p.status === "running");
    // A comparison counts as finished while away when its last image did (and every image is safe in the Library).
    return { ...r, parts, status: running ? "running" : "done", ...(running || r.doneAt ? {} : { doneAt: Date.now() }), away: !running && Boolean(patch.away) && !parts.some((p) => p.unsaved) };
  })), []);
  const runPart = useCallback(async (key, m, o, delay) => {
    try {
      if (delay) await sleep(delay);
      for (let attempt = 1; ; attempt++) {
        let res;
        try { res = await post("/api/generate", { prompt: o.prompt, style: "None", aspectRatio: o.ratio, tier: m.id, format: o.format || "free", ...(o.project ? { project: o.project } : {}) }); }
        catch { patchPart(key, m.id, { lost: true }); watchRef.current(); return; } // no answer: look for it in the Library (see startImage)
        const d = await json(res); sync(d);
        // The provider limits how many generations can start at once. Wait and try again instead of failing.
        if (res.status === 429 && attempt < 3) { await sleep(10_000); continue; }
        if (res.status === 402 || res.status === 401) { refused(d, m.cost, m.name); throw new Error(d.needSignIn ? t("Sign in to create.") : t("Not enough credits for this one.")); }
        if (!res.ok || d.error || !d.imageUrl) throw new Error(plain(d.error) || t("This one didn't finish. Its credits were returned."));
        const item = toItem({ id: d.id, public_url: d.imageUrl, prompt: o.prompt, aspect_ratio: o.ratio, model: d.tier || m.id, project_id: d.project });
        if (d.stored) addItem(item, { keep: "project" in d });
        patchPart(key, m.id, { status: "done", item, unsaved: !d.stored, doneAt: Date.now(), lost: false, away: awaySince(Date.now() - 1500) });
        return;
      }
    } catch (e) { patchPart(key, m.id, { status: "failed", error: e.message || t("This one didn't finish. Its credits were returned.") }); }
  }, [sync, refused, addItem, patchPart, awaySince]);
  const startCompare = useCallback((o) => {
    const plan = comparePlan(o.models);
    if (!plan) return false;
    const w = walletRef.current;
    if (w.loaded && !w.admin && !covers(w, plan.models.map((m) => m.cost))) {
      if (!w.account) askSignIn(t(SIGN_UP_REASON, { n: FREE_DAILY })); else askCredits(plan.cost, t("Compare {n} models", { n: plan.models.length }));
      return false;
    }
    const key = uid(); const t0 = Date.now();
    setRuns((rs) => [...trim(rs), { key, kind: "compare", prompt: o.prompt, label: t("Comparing {n} models", { n: plan.models.length }), ratio: o.ratio, cost: plan.cost, status: "running", t0, skip: itemsRef.current.slice(0, 12).map((x) => x.id), again: { prompt: o.prompt, ratio: o.ratio, format: o.format, project: projectRef.current },
      parts: plan.models.map((m) => ({ id: m.id, name: m.name, cost: m.cost, status: "running", t0, eta: m.id === "fast" ? 6 : 25 })) }]);
    markSeen();
    plan.models.forEach((m, i) => runPart(key, m, { ...o, project: projectRef.current }, i * 700)); // a small gap between starts is kinder to the provider's limits
    return true;
  }, [askSignIn, askCredits, runPart]);
  const retryPart = useCallback((run, id) => {
    const m = imageModel(id); if (!run?.again || m.id !== id) return;
    if (!afford(m.cost, { label: m.name })) return;
    patchPart(run.key, id, { status: "running", t0: Date.now(), error: null, lost: false });
    runPart(run.key, m, run.again, 0);
  }, [afford, patchPart, runPart]);

  const pollJob = useCallback(async (key, job) => {
    const started = Date.now();
    let seen = started; // the last moment the video was known to be still rendering
    while (Date.now() - started < 20 * 60_000) {
      await sleep(4000);
      const s = await get(`/api/animate?job=${encodeURIComponent(job)}`).then(json).catch(() => ({ status: "processing" }));
      if (s.status === "processing") { seen = Date.now(); continue; }
      sync(s);
      if (s.status === "done" && s.item) {
        const item = toItem(s.item), away = awaySince(seen);
        addItem(item, { keep: true }); patchRun(key, { status: "done", item, doneAt: Date.now(), away });
        if (!away) say(t("Your video is ready"));
        return;
      }
      throw new Error(plain(s.error) || t("The video didn't finish. Your credits were returned."));
    }
    patchRun(key, { status: "late" });
  }, [sync, addItem, patchRun, say, awaySince]);

  const startVideo = useCallback((o) => {
    // o.source: start from an existing image. With a model from the picker that can do it (o.model), the video is
    // made on that model, at its own length and quality. Otherwise it is "Animate": Wan's image model, fixed price.
    // Without o.source: text-to-video on the chosen model.
    const m = videoModel(o.model);
    const picked = Boolean(o.source && o.model && videoTakesImage(m.id));
    const fixed = Boolean(o.source) && !picked;
    const plan = fixed ? null : videoPlan(m.id, o.d, o.r, o.source ? o.source.ratio : o.ratio, picked);
    if (!fixed && !plan) { say(t("That length and quality aren't available on this model.")); return false; }
    const cost = fixed ? TOOLS.animate.cost : plan.cost;
    const label = fixed ? `${TOOLS.animate.label}, ${TOOLS.animate.detail}` : `${m.name}, ${plan.d} s, ${plan.r}`;
    if (!afford(cost, { paidOnly: true, label: fixed ? TOOLS.animate.label : m.name })) return false;
    const key = uid();
    setRuns((rs) => [...trim(rs), { key, kind: "video", prompt: o.prompt, label, ratio: o.source ? o.source.ratio || "1:1" : plan.ratio, cost, status: "running", t0: Date.now(), eta: fixed ? 75 : Math.round(m.eta * (plan.d > 6 ? 1.6 : 1)), poster: o.source?.url, again: { ...o, kind: "video" } }]);
    markSeen();
    (async () => {
      try {
        const pid = projectRef.current; // the video is filed in the project that is open when it starts
        const res = await post("/api/animate", { ...(fixed ? { id: o.source.id, ...(o.prompt ? { prompt: o.prompt } : {}) } : picked ? { model: m.id, id: o.source.id, ...(o.prompt ? { prompt: o.prompt } : {}), duration: plan.d, resolution: plan.r } : { model: m.id, prompt: o.prompt, aspectRatio: plan.ratio, duration: plan.d, resolution: plan.r, ...(o.improve ? { improve: true } : {}) }), ...(pid ? { project: pid } : {}) });
        const d = await json(res); sync(d);
        if (res.status === 402 || res.status === 401) { dropRun(key); refused(d, cost, label, true); return; }
        if (typeof d.usedPrompt === "string") patchRun(key, { used: d.usedPrompt }); // shown beside the caption when the video is ready
        if (!res.ok || !d.job) throw new Error(plain(d.error) || t("The video couldn't start. Your credits were returned."));
        await pollJob(key, d.job);
      } catch (e) { patchRun(key, { status: "failed", error: e.message || t("The video didn't finish. Your credits were returned.") }); }
    })();
    return true;
  }, [afford, refused, sync, patchRun, dropRun, pollJob, say]);

  // ---- images whose answer never arrived ----
  // The page was closed, the phone put the browser to sleep, or the network dropped. The server finishes and
  // saves the image anyway, so the result is looked for in the Library. findMade() makes one pass and returns
  // how many are still missing; watch() keeps looking until they are found or it has been too long.
  const lastPass = useRef(0);
  const findMade = useCallback(async (returning) => {
    const waiting = [];
    for (const r of runsRef.current) {
      if (r.kind === "image" && r.status === "running" && r.model) waiting.push({ key: r.key, model: r.model, prompt: r.prompt, t0: r.t0, skip: r.skip, lost: r.lost });
      if (r.kind === "compare") for (const p of r.parts) if (p.status === "running") waiting.push({ key: r.key, part: p.id, model: p.id, prompt: r.prompt, t0: p.t0, skip: r.skip, lost: p.lost });
    }
    if (!waiting.length) return 0;
    const d = await get("/api/history?limit=24").then(json).catch(() => null);
    const found = (d?.items || []).map(toItem).reverse(); // oldest first, so two requests with the same words get their own results in order
    const taken = new Set(); // results already on screen are spoken for
    for (const r of runsRef.current) { if (r.item?.id) taken.add(r.item.id); for (const p of r.parts || []) if (p.item?.id) taken.add(p.item.id); }
    // Found on the first look after coming back (or after the page was opened again): it finished while the
    // person was away, so it belongs to the Library and is not put on the Create screen.
    const away = Boolean(returning) || awaySince(lastPass.current);
    lastPass.current = Date.now();
    let open = 0;
    for (const w of waiting.sort((a, b) => a.t0 - b.t0)) {
      const item = found.find((x) => answers(x, w, taken));
      if (item) {
        taken.add(item.id); addItem(item, { keep: true });
        if (w.part) patchPart(w.key, w.part, { status: "done", item, doneAt: Date.now(), lost: false, away }); else patchRun(w.key, { status: "done", item, doneAt: Date.now(), lost: false, away });
      } else if (w.lost && Date.now() - w.t0 > 140_000) {
        if (w.part) patchPart(w.key, w.part, { status: "failed", error: t(LOST_MSG), lost: false }); else patchRun(w.key, { status: "failed", error: t(LOST_MSG), lost: false });
      } else if (w.lost) open++;
    }
    return open;
  }, [addItem, patchRun, patchPart, awaySince]);
  const watching = useRef(false);
  const watch = useCallback(async () => {
    if (watching.current) return;
    watching.current = true;
    try { for (let i = 0; i < 50; i++) { await sleep(i ? 4000 : 600); if (!(await findMade())) break; } }
    finally { watching.current = false; }
  }, [findMade]);
  const watchRef = useRef(() => {}); watchRef.current = watch;
  // Back on the page after the phone was locked or another app was open: requests may have been cut off without
  // a word. Look once right away; anything that has been "running" far too long is treated as cut off.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState !== "visible") return;
      backAt.current = Date.now(); beat.current = Date.now();
      if (note.current) { const msg = note.current; note.current = ""; setTimeout(() => say(msg), 400); }
      const late = (t0) => Date.now() - t0 > 90_000;
      setRuns((rs) => rs.map((r) => (r.kind === "image" && r.status === "running" && !r.lost && late(r.t0) ? { ...r, lost: true }
        : r.kind === "compare" && r.parts.some((p) => p.status === "running" && !p.lost && late(p.t0)) ? { ...r, parts: r.parts.map((p) => (p.status === "running" && late(p.t0) ? { ...p, lost: true } : p)) } : r)));
      setTimeout(() => watchRef.current(), 50);
    };
    document.addEventListener("visibilitychange", back); window.addEventListener("pageshow", back);
    return () => { document.removeEventListener("visibilitychange", back); window.removeEventListener("pageshow", back); };
  }, [say]);

  const retry = useCallback((run) => { dropRun(run.key); if (run.again?.kind === "video") startVideo(run.again); else if (run.again) startImage(run.again); }, [dropRun, startVideo, startImage]);

  // The improve button in the prompt box: the idea is filled in right there, so it can be read and changed before
  // anything is made. Undo puts the person's own words back.
  const improveNow = useCallback(async () => {
    if (needAccount({ tab: "create" })) return;
    const text = prompt.trim();
    if (!text || improving) return;
    setImproving(true);
    try {
      const d = await json(await post("/api/improve", { prompt: text, kind: mode === "video" ? "video" : "image" }));
      if (d.error) say(plain(d.error));
      else if (d.improved && d.prompt) { setPolish({ original: prompt }); setPrompt(d.prompt); }
      else say(d.why === "long" ? t("This prompt is already detailed. It will be used as you wrote it.") : d.why === "limit" ? t("You've used today's prompt improvements. Your prompt will be used as you write it.") : t("Couldn't improve the prompt right now. Try again in a moment."));
    } catch { say(t("Couldn't improve the prompt right now. Try again in a moment.")); }
    finally { setImproving(false); }
  }, [prompt, mode, improving, needAccount, say]);
  const undoImprove = useCallback(() => { if (polish) { setPrompt(polish.original); setPolish(null); } }, [polish]);
  useEffect(() => { if (!prompt.trim()) setPolish(null); }, [prompt]); // an empty box has nothing to take back

  // The Generate button.
  const askedWallet = useRef(false);
  const generateRef = useRef(null);
  const generate = useCallback(() => {
    // The balance is not known yet (the page has only just opened): find it out first, then press again. So a
    // price the wallet cannot cover opens "Add credits" and never starts a creation. Asked once; if the balance
    // cannot be read, the server decides as before.
    if (!walletRef.current.loaded && !askedWallet.current) { askedWallet.current = true; refreshWallet().finally(() => setTimeout(() => generateRef.current?.(), 60)); return; }
    if (needAccount({ tab: "create" })) return;
    const text = prompt.trim();
    if (mode === "video") {
      if (ref) { if (startVideo({ source: ref, prompt: text, model: vidModel, d: vDur, r: vRes })) { setPrompt(""); setRef(null); } return; }
      if (!text) { say(t("Describe the video first.")); return; }
      if (startVideo({ model: vidModel, prompt: text, ratio, d: vDur, r: vRes, improve: improve && !polish })) setPrompt("");
      return;
    }
    if (!text) { say(t("Describe the image first.")); return; }
    if (!ref && comparePlan(compare)) { if (startCompare({ models: compare, prompt: text, ratio: FORMATS[format]?.ratio || ratio, format })) setPrompt(""); return; }
    const pick = auto && !ref ? autoPick(`${text} ${format !== "free" ? FORMATS[format]?.label || "" : ""}`, walletRef.current, walletRef.current.off) : null;
    if (startImage({ model: pick ? pick.id : imgModel, prompt: text, ratio, ref, format, auto: Boolean(pick), improve: improve && !polish })) setPrompt("");
  }, [prompt, mode, ref, vidModel, ratio, vDur, vRes, imgModel, auto, compare, format, improve, polish, startVideo, startImage, startCompare, say, needAccount, refreshWallet]);
  generateRef.current = generate;

  // ---- tools on an existing image ----
  const runTool = useCallback(async (tool, item, extra = {}) => {
    const tl = TOOLS[tool];
    if (needAccount()) return false;
    if (!item?.id) { say(t("This image wasn't saved, so it can't be changed.")); return false; }
    if (busyTool) return false;
    if (!afford(tl.cost, { paidOnly: tl.paidOnly, label: tl.label })) return false;
    setBusyTool(tool);
    try {
      const res = await post(`/api/${tool}`, { id: item.id, ...extra, ...inProject() });
      const d = await json(res); sync(d);
      if (res.status === 402 || res.status === 401) { refused(d, tl.cost, tl.label, tl.paidOnly); return false; }
      if (!res.ok || !d.item) throw new Error(plain(d.error) || t("{name} didn't finish. Any credits were returned.", { name: tl.label }));
      const made = toItem(d.item);
      addItem(made, { keep: "project_id" in d.item });
      setViewer({ item: made, before: item });
      if (tabRef.current === "create") setRuns((rs) => [...trim(rs), { key: uid(), kind: "image", prompt: made.prompt, label: tl.label, ratio: made.ratio, status: "done", item: made, doneAt: Date.now() }]);
      say(tl.done);
      return true;
    } catch (e) { say(e.message); return false; }
    finally { setBusyTool(""); }
  }, [busyTool, afford, refused, sync, addItem, say, needAccount]);

  const animate = useCallback((item) => {
    if (needAccount()) return;
    if (!item?.id) { say(t("This image wasn't saved, so it can't be animated.")); return; }
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
    if (!res || !res.ok) { say(t("Couldn't delete. Try again.")); return; }
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
      say(d.refunded ? t("That video's file was missing or damaged. It was removed and {n} credits were returned.", { n: d.refunded }) : t("That video's file was missing or damaged, so it was removed."));
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
      if (!res.ok || !d.item) throw new Error(plain(d.error) || (res.status === 413 ? t("That photo is too large. Try a smaller one.") : t("The upload didn't work. Try again.")));
      const item = toItem(d.item);
      addItem(item); setRef(item); setTab("create");
    } catch (e) { say(e.message || t("The upload didn't work. Try again.")); }
    finally { setUploading(false); uploadLock.current = false; }
  }, [addItem, say, needAccount, askSignIn]);

  // ---- account ----
  const signedIn = useCallback(async () => {
    setSheet(null);
    if (afterSignIn.current) { setTab(afterSignIn.current); afterSignIn.current = null; }
    store.write("pp_draft", null);
    await refreshWallet(); loadLibrary(); loadProjects(); say(t("You're signed in"));
  }, [refreshWallet, loadLibrary, loadProjects, say]);
  // Admin only: put one of your own creations in the Explore gallery, or take it out.
  const feature = useCallback(async (item, on) => {
    const res = await post("/api/admin/feature", { id: item.id, on }).catch(() => null);
    const d = res ? await json(res) : {};
    if (!res || !res.ok) { say(plain(d.error) || t("Could not save. Try again.")); return false; }
    setItems((xs) => xs.map((x) => (x.id === item.id ? { ...x, featured: on } : x)));
    setViewer((v) => (v && v.item.id === item.id ? { ...v, item: { ...v.item, featured: on } } : v));
    say(on ? t("Showing in Explore") : t("Removed from Explore"));
    loadExplore();
    return true;
  }, [say, loadExplore]);
  // Deletes the account and everything it made. Returns an error message, or nothing when it worked (the page
  // then starts over as a visitor).
  const deleteAccount = useCallback(async () => {
    const res = await post("/api/account/delete", { confirm: "DELETE" }).catch(() => null);
    const d = res ? await json(res) : {};
    if (!res || !res.ok) return plain(d.error) || t("Your account could not be deleted. Try again.");
    ["pp_pending", "pp_last", "pp_favs", "pp_draft", "pp_seen"].forEach((k) => store.write(k, null));
    window.location.href = "/";
    return "";
  }, []);
  const signOut = useCallback(async () => { await post("/api/auth/signout").catch(() => {}); store.write("pp_pending", []); store.write("pp_last", null); window.location.href = "/"; }, []);
  const buy = useCallback(async (planId) => {
    const res = await post("/api/checkout", { plan: planId }).catch(() => null);
    const d = res ? await json(res) : {};
    if (res?.ok && d.url) { window.location.href = d.url; return; }
    say(plain(d.error) || t("Checkout isn't available right now."));
  }, [say]);

  const setVidModel = useCallback((id) => { setVidModelRaw(id); setVDur(null); setVRes(null); }, []);
  const setTheme = useCallback((t) => { setThemeRaw(t); }, []);

  // ---- remember choices ----
  useEffect(() => { if (ready) store.write("pp_studio", { mode, imgModel, vidModel, auto, compare, ratio, theme, project, improve }); }, [ready, mode, imgModel, vidModel, auto, compare, ratio, theme, improve, project]);
  // Remembered on this device: the images still being made, so they can be found after the page was closed.
  // (Videos have their own record on the server.) Finished results are not remembered: they are in the Library.
  useEffect(() => {
    if (!ready) return;
    store.write("pp_pending", runs.filter((r) => (r.kind === "image" && r.model && r.status === "running") || (r.kind === "compare" && r.status === "running")).map(slimRun));
  }, [ready, runs]);

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
    let seen = Date.now(); // the last moment these videos were known to be still rendering
    const timer = setInterval(async () => {
      const jobs = await checkPending();
      if (!jobs) return;
      const away = awaySince(seen); seen = Date.now();
      let reload = false;
      for (const r of runsRef.current.filter((x) => x.resumed && x.status === "running")) {
        const j = jobs.find((x) => x.id === r.jobId);
        if (j && j.status === "processing") continue;
        if (j && j.status === "failed") patchRun(r.key, { status: "failed", error: plain(j.error) || t("The video didn't finish. Your credits were returned.") });
        else if (j?.item) { const item = toItem(j.item); addItem(item, { keep: true }); patchRun(r.key, { status: "done", item, doneAt: Date.now(), away }); }
        else { dropRun(r.key); reload = true; }
      }
      if (reload) {
        await loadLibrary();
        const d = await get("/api/history?limit=6").then(json).catch(() => null);
        const item = (d?.items || []).map(toItem).find((x) => x.video);
        if (item && !away) setRuns((rs) => (rs.some((x) => x.item?.id === item.id) ? rs : [...trim(rs), { key: `h${item.id}`, kind: "video", prompt: item.prompt, label: madeWith(item.model), ratio: item.ratio, status: "done", item, doneAt: Date.now() }]));
        tell(away ? t("Your video is ready in your Library") : t("Your video is ready"));
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [hasResumed, checkPending, addItem, patchRun, dropRun, loadLibrary, tell, awaySince]);

  // ---- is this page the current build? ----
  // A page left open keeps running the build it was loaded with. On coming back to it, ask the site which build
  // is live. If it is a newer one: reload at once when nothing would be lost (nothing being made, nothing typed,
  // nothing open), otherwise show a line with a Reload button. One automatic reload per build, never a loop.
  const idleRef = useRef(true);
  idleRef.current = !prompt.trim() && !sheet && !viewer && !area && !ref && !runs.some((r) => r.status === "running");
  useEffect(() => {
    if (BUILD === "dev") return;
    let last = 0;
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - last < 30_000) return;
      last = Date.now();
      const d = await get("/api/version").then(json).catch(() => null);
      if (!d?.build || d.build === "dev" || d.build === BUILD) return;
      let tried = null; try { tried = sessionStorage.getItem("pp_reload"); } catch {}
      if (idleRef.current && tried !== d.build) { try { sessionStorage.setItem("pp_reload", d.build); } catch {} window.location.reload(); return; }
      setNewer(true);
    };
    check();
    document.addEventListener("visibilitychange", check); window.addEventListener("focus", check);
    const timer = setInterval(check, 120_000);
    return () => { document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); clearInterval(timer); };
  }, []);

  // ---- first load ----
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = store.read("pp_studio", {});
    if (p.mode === "video") setMode("video");
    if (imageModels.some((m) => m.id === p.imgModel)) setImgModelRaw(p.imgModel);
    if (videoModels.some((m) => m.id === p.vidModel)) setVidModelRaw(p.vidModel);
    const cp = comparePlan(p.compare); if (cp) setCompare(cp.models.map((m) => m.id)); else if (p.auto === true) setAutoRaw(true);
    const chosen = Boolean(cp) || p.auto === true; // the visitor chose Auto or a comparison: a format's suggested model doesn't replace that
    if (IMAGE_RATIOS.some((r) => r.id === p.ratio)) setRatio(p.ratio);
    if (typeof p.project === "string" && /^[0-9a-f-]{36}$/i.test(p.project)) { projectRef.current = p.project; setProjectRaw(p.project); }
    if (["dark", "light", "auto"].includes(p.theme)) setThemeRaw(p.theme);
    if (p.improve === false) setImprove(false);
    loadExplore();
    setFavs(new Set(store.read("pp_favs", [])));

    let start = store.read("pp_seen", 0) ? "create" : "explore";
    const tabQ = q.get("tab");
    if (tabQ === "me") start = "library"; else if (tabQ === "community") start = "explore"; else if (tabQ === "create") start = "create";
    const f = q.get("format");
    if (f && FORMATS[f] && f !== "free") {
      setFormat(f); setMode("image"); start = "create";
      if (FORMATS[f].ratio && IMAGE_RATIOS.some((r) => r.id === FORMATS[f].ratio)) setRatio(FORMATS[f].ratio);
      if (!chosen && FORMATS[f].engine && imageModels.some((m) => m.id === FORMATS[f].engine)) setImgModelRaw(FORMATS[f].engine);
    }
    if (q.get("p")) { setPrompt(q.get("p").slice(0, 1500)); setMode("image"); start = "create"; }
    if (videoModels.some((m) => m.id === q.get("video"))) { // a link that opens Create ready for one video (the prompt list on /admin)
      setMode("video"); setVidModelRaw(q.get("video")); start = "create";
      if (IMAGE_RATIOS.some((r) => r.id === q.get("ratio"))) setRatio(q.get("ratio"));
    }
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
        if (["explore", "create", "library"].includes(d.tab)) start = d.tab;
        if (d.mode === "video" || d.mode === "image") setMode(d.mode);
        if (typeof d.prompt === "string" && d.prompt) setPrompt(d.prompt.slice(0, 1500));
        if (d.ref?.id && typeof d.ref.url === "string") setRef(toItem({ id: d.ref.id, public_url: d.ref.url, aspect_ratio: d.ref.ratio }));
      }
      store.write("pp_draft", null);
      setTimeout(() => say(t("You're signed in")), 300);
    }
    if (q.get("signin") === "1") setTimeout(() => askSignIn(), 200);
    if (q.get("paid") === "1") {
      setTimeout(() => say(t("Thank you. Your credits are on the way.")), 300);
      [3000, 8000, 20000].forEach((ms) => setTimeout(refreshWallet, ms));
      setTimeout(async () => { const d = await refreshWallet(); if (d && !d.account && !d.admin) askSignIn(t("Purchase complete. Sign in so your credits are safe on every device.")); }, 2500);
    }
    if (window.location.search) window.history.replaceState(null, "", window.location.pathname);
    // What this device remembers: images that were still being made when the page was closed (up to half an
    // hour ago). They stay out of sight until the first look in the Library: the ones that finished in the
    // meantime are simply in the Library, and only the ones still being made come back as a loading frame.
    const cleanRun = (r) => {
      if (!r || typeof r.prompt !== "string" || !["image", "compare"].includes(r.kind)) return null;
      const ratio = IMAGE_RATIOS.some((x) => x.id === r.ratio) ? r.ratio : "1:1";
      const base = { key: uid(), kind: r.kind, prompt: r.prompt, label: String(r.label || "Image"), ratio, cost: Number(r.cost) || 0, t0: Number(r.t0) || Date.now(), eta: Number(r.eta) || 20, skip: Array.isArray(r.skip) ? r.skip.slice(0, 12) : [], checking: true };
      if (r.kind !== "compare") return typeof r.model === "string" ? { ...base, model: r.model, status: "running", lost: true } : null;
      const parts = (Array.isArray(r.parts) ? r.parts : []).filter((p) => p && typeof p.id === "string").slice(0, 4)
        .map((p) => ({ id: p.id, name: String(p.name || p.id), cost: Number(p.cost) || 0, t0: Number(p.t0) || base.t0, eta: Number(p.eta) || 25,
          ...(okItem(p.item) ? { status: "done", item: p.item } : p.status === "running" ? { status: "running", lost: true } : { status: "failed", error: String(p.error || t(LOST_MSG)) }) }));
      return parts.length >= 2 && parts.some((p) => p.status === "running") ? { ...base, parts, status: "running" } : null;
    };
    const saved = store.read("pp_pending", []);
    const back = (Array.isArray(saved) ? saved : []).filter((r) => r && Date.now() - Number(r.t0) < 30 * 60_000).slice(0, 6).map(cleanRun).filter(Boolean);
    store.write("pp_last", null); // left by an earlier version
    if (back.length) { setRuns(back); start = "create"; }
    setTab(start);
    // The words must be there before the first screen is drawn, so nobody sees it flip from English.
    let want = null;
    try { want = (document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([a-z]+)`)) || [])[1] || localStorage.getItem(LANG_COOKIE); } catch { /* private mode */ }
    if (!isLang(want)) want = pickLang(navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language]);
    (want === "en" ? Promise.resolve() : setLang(want)).finally(() => setReady(true));

    refreshWallet().then((d) => {
      // Projects belong to an account. Without one, nothing is filtered by a project remembered on this device.
      if (d?.account || d?.admin) loadProjects(); else if (projectRef.current) setProject(null);
      if (d?.account) get("/api/favorites").then(json).then((fv) => { if (fv.cloud && Array.isArray(fv.ids)) setFavs((prev) => new Set([...prev, ...fv.ids])); }).catch(() => {});
    });
    (async () => {
      await post("/api/session").catch(() => {});
      const jobs = (await checkPending()) || [];
      await loadLibrary();
      const waiting = jobs.filter((j) => j.status === "processing").map((j) => ({
        key: `j${j.id}`, jobId: j.id, resumed: true, kind: "video", prompt: j.prompt || "", label: madeWith(j.kind), ratio: "16:9",
        status: "running", t0: Date.parse(j.started) || Date.now(), eta: 150,
      }));
      // A video that ended badly while the page was closed: say so (the credits are already back).
      const ended = jobs.filter((j) => j.status === "failed").map((j) => ({
        key: `j${j.id}`, kind: "video", prompt: j.prompt || "", label: madeWith(j.kind), ratio: "16:9", status: "failed",
        error: plain(j.error) || t("The video didn't finish. Your credits were returned."),
      }));
      setRuns((rs) => [...ended, ...waiting, ...rs]);
      if (back.length) {
        await sleep(50);
        const open = await findMade(true);
        setRuns((rs) => rs.map((r) => (r.checking ? { ...r, checking: false } : r)));
        if (open) watch();
      }
    })();
  }, []);

  // What the screens see: not the requests still being looked up after the page was opened again, and not a
  // result that finished while the person was away (it is in the Library).
  const shown = useMemo(() => runs.filter((r) => !r.checking && !(r.status === "done" && r.away)), [runs]);
  return {
    ready, tab, setTab, mode, setMode, prompt, setPrompt, imgModel, setImgModel, vidModel, setVidModel, auto, setAuto, improve, setImprove, polish, improving, improveNow, undoImprove, compare, setCompare, ratio, setRatio,
    vDur, setVDur, vRes, setVRes, ref, setRef, format, setFormat, wallet, runs: shown, items, cursor, library, favs,
    off, projects, projectsOn, project, setProject, createProject, renameProject, deleteProject, moveItem,
    viewer, setViewer, sheet, setSheet, area, setArea, newer, toast, say, theme, setTheme, busyTool, uploading,
    generate, retry, retryPart, dropRun, runTool, animate, variations, useAgain, remove, upload, toggleFav, loadMore, reportVideo, savePoster, posters,
    askSignIn, needAccount, askCredits, signedIn, signOut, buy, refreshWallet,
    page, setPage, lang, setLang, explore, feature, deleteAccount,
  };
}
