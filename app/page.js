"use client";
import { useState, useEffect, useRef } from "react";
import RepaintEditor, { REPAINT_CSS } from "./RepaintEditor";
import { prepareUpload, uploadRaw } from "./clientImage";
import Gallery, { GALLERY_CSS, downloadImage } from "./Gallery";
import { FORMATS, FORMAT_LIST, FORMAT_GROUPS } from "../lib/formats";
import Thumb, { THUMB_CSS } from "./Thumb";
import ImageActions, { IA_CSS } from "./ImageActions";
import PricingModal from "./PricingModal";
import AuthSheet from "./AuthSheet";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [tier, setTier] = useState("fast");
  const TIERS = [
    { id: "fast", label: "Fast", icon: "⚡", cost: 1, desc: "Quick drafts" },
    { id: "quality", label: "Quality", icon: "💎", cost: 4, desc: "Best detail" },
    { id: "text", label: "Text", icon: "🔤", cost: 3, desc: "Text in images" },
  ];
  const tierCost = (TIERS.find((t) => t.id === tier) || TIERS[0]).cost;
  const tierLabel = (id) => { if (id === "upload") return "⇪ Upload"; if (id === "guided") return "◎ Guided"; if (id === "edit") return "✎ Edited"; const t = TIERS.find((x) => x.id === (id || "fast")); return t ? `${t.icon} ${t.label}` : ""; };
  const safeTier = (id) => (TIERS.some((t) => t.id === id) ? id : "fast");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Initializing AI studio...");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(10);
  const [paid, setPaid] = useState(0);
  const [plans, setPlans] = useState(null);
  const [account, setAccount] = useState(null); // { email } when signed in
  const [authOpen, setAuthOpen] = useState(null); // null | { reason }
  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
    try { localStorage.removeItem("pp_history"); } catch {}
    window.location.replace("/");
  };
  const [pricing, setPricing] = useState(null); // { need } when open
  const copyRestoreCode = async () => {
    const d = await fetch("/api/restore", { cache: "no-store" }).then((r) => r.json()).catch(() => ({}));
    if (!d.code) { showToast("No paid credits on this device yet"); return; }
    try { await navigator.clipboard.writeText(d.code); showToast("Restore code copied — keep it somewhere safe"); } catch { window.prompt("Your restore code — keep it safe:", d.code); }
  };
  const restorePurchase = async () => {
    const code = window.prompt("Paste your PixelPulse restore code (PP-…). This device will switch to that purchase and its gallery.", "");
    if (!code) return;
    const r = await fetch("/api/restore", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(d.error || "Couldn't restore"); return; }
    showToast(`Restored · ${d.paid || 0}⚡ paid balance`); setTimeout(() => window.location.reload(), 900);
  };
  const openPricing = (label, cost) => setPricing({ need: label ? { label, cost } : null });
  const syncCredits = (d) => { if (d?.admin) setIsAdmin(true); else if (typeof d?.credits === "number") setCredits(d.credits); if (typeof d?.paid === "number") setPaid(d.paid); };
  const [history, setHistory] = useState([]);
  const [communityFeed, setCommunityFeed] = useState([]);
  const [activeTab, setActiveTab] = useState("create"); // "create" or "community"
  const [currentItem, setCurrentItem] = useState(null); // last generated item (with id)
  const [remixOf, setRemixOf] = useState(null);
  const [storageEnabled, setStorageEnabled] = useState(true);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedLoading, setFeedLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [notice, setNotice] = useState("");
  const [format, setFormat] = useState("free");
  const [dailyJoin, setDailyJoin] = useState(false);
  const [daily, setDaily] = useState(null);
  const [streak, setStreak] = useState(0);
  const [feedView, setFeedView] = useState("latest");
  const fmtDef = FORMATS[format] || FORMATS.free;
  const loadDaily = () => fetch("/api/daily", { cache: "no-store" }).then((r) => r.json()).then((d) => { if (d?.theme) { setDaily(d); setStreak(d.streak || 0); } }).catch(() => {});
  const [fmtQuery, setFmtQuery] = useState("");
  const selectFormat = (id, quiet) => {
    const f = FORMATS[id] || FORMATS.free;
    setFormat(f.id);
    if (f.ratio) setAspectRatio(f.ratio);
    if (f.engine) setTier(f.engine);
    if (!quiet && f.id !== "free") { setToast(`${f.icon} ${f.label} · ${f.blurb}`); clearTimeout(window.__ppToast); window.__ppToast = setTimeout(() => setToast(""), 2600); }
  };
  const fileName = (item) => `pixelpulse-${item?.format && item.format !== "free" ? item.format : "image"}-${(item?.id || String(Date.now())).slice(0, 8)}`;

  const stylesList = [
    "None",
    "Cinematic",
    "Photorealistic",
    "3D Render",
    "Anime",
    "Cyberpunk",
    "Fantasy",
    "Oil Painting",
    "Watercolor"
  ];

  const ratiosList = [
    { id: "1:1", label: "Square (1:1)", icon: "⏹️" },
    { id: "9:16", label: "Story (9:16)", icon: "📱" },
    { id: "16:9", label: "Wide (16:9)", icon: "💻" },
  ];

  const surprisePrompts = [
    "Raw candid portrait photo of a rugged astronaut taking off his helmet on a lush alien planet with glowing bioluminescent plants, golden hour lighting, shot on 35mm lens",
    "A futuristic luxury sports car speeding through a neon-lit cyberpunk tunnel in Tokyo at night, rain reflections on wet asphalt, motion blur",
    "Macro DSLR photo of a tiny miniature steampunk city built inside an antique glass lightbulb resting on an old wooden desk, warm glowing filaments",
    "An ancient stone dragon waking up inside a crystal cave, glowing magma flowing through cracks in its scales, epic fantasy atmosphere",
    "Hyper-realistic close-up of a sleek black panther with glowing emerald eyes walking through a misty bamboo forest at dawn"
  ];

  // Normalize API rows into UI items
  const toItem = (r) => ({
    id: r.id,
    url: r.public_url,
    prompt: r.prompt,
    style: r.style,
    aspectRatio: r.aspect_ratio,
    tier: r.model || null,
    likes: r.likes || 0,
    liked: Boolean(r.liked),
    isPublic: Boolean(r.is_public),
    remixOf: r.remix_of || null,
    format: r.format || null,
    dailyDay: r.daily_day || null,
  });

  // Browser-only history (cloud save failed / pre-cloud): Replicate delivery URLs expire ~1h;
  // pre-rekey paths ("images/<uuid>/...") were moved by /api/admin/rekey. Never keep them.
  const isStaleLocalUrl = (u) => {
    if (typeof u !== "string" || !u) return true;
    if (/replicate\.delivery|pbxt\.replicate/.test(u)) return true;
    if (/\/storage\/v1\/object\/public\/images\/(?!i\/|t\/)/.test(u)) return true;
    return false;
  };
  const writeLocalHistory = (arr) => { try { localStorage.setItem("pp_history", JSON.stringify(arr.filter((h) => h && !h.id).slice(0, 12))); } catch {} };
  const dropDeadLocal = (item) => {
    if (!item || item.id) return;
    setHistory((prev) => prev.filter((h) => h !== item && h.url !== item.url));
    try { writeLocalHistory((JSON.parse(localStorage.getItem("pp_history") || "[]") || []).filter((h) => h && h.url !== item.url)); } catch {}
  };
  const loadHistory = async () => {
    try {
      const d = await fetch("/api/history").then((r) => r.json());
      let local = [];
      try { local = (JSON.parse(localStorage.getItem("pp_history") || "[]") || []).filter((h) => h && !h.id && typeof h.url === "string" && !isStaleLocalUrl(h.url)); } catch {}
      // Actively drop browser-only URLs that 404 (covers anything isStaleLocalUrl missed)
      if (local.length) {
        const ok = await Promise.all(local.map(async (h) => {
          try { const r = await fetch(h.url, { method: "HEAD", mode: "cors", cache: "no-store" }); return r.ok ? h : null; }
          catch { return null; }
        }));
        local = ok.filter(Boolean);
      }
      writeLocalHistory(local);
      if (d.enabled === false) { setStorageEnabled(false); setHistory(local); return; }
      setStorageEnabled(true);
      if (Array.isArray(d.items)) { const seen = new Set(); setHistory([...local, ...d.items.map(toItem)].filter((h) => !h.id || (!seen.has(h.id) && seen.add(h.id))).slice(0, 36)); }
      else setHistory(local);
    } catch (e) { console.error(e); }
  };

  const loadFeed = async (cursor = null) => {
    setFeedLoading(true);
    try {
      const qs = cursor ? `?before=${encodeURIComponent(cursor)}` : "";
      const d = await fetch(`/api/feed${qs}`).then((r) => r.json());
      if (Array.isArray(d.items)) {
        const items = d.items.map(toItem);
        setCommunityFeed((prev) => (cursor ? [...prev, ...items] : items));
      }
      setFeedCursor(d.nextCursor || null);
    } catch (e) {
      console.error(e);
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem("pp_credits");
      localStorage.removeItem("pp_community");
    } catch {}
    const loadCredits = () => fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => {
        if (d.admin) setIsAdmin(true);
        else if (typeof d.credits === "number") setCredits(d.credits);
        if (typeof d.paid === "number") setPaid(d.paid); if (Array.isArray(d.plans)) setPlans(d.plans); if ("account" in d) setAccount(d.account);
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (["me", "community", "create"].includes(params.get("tab"))) setActiveTab(params.get("tab"));
    if (params.get("signedin") === "1") { params.delete("signedin"); window.history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : "")); setTimeout(() => { setToast("✓ Signed in — your pulses are synced"); setTimeout(() => setToast(""), 3000); }, 300); }
    if (params.get("paid") === "1") {
      params.delete("paid"); window.history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : ""));
      setTimeout(() => { setToast("⚡ Thanks! Your credits are on the way"); setTimeout(() => setToast(""), 3500); }, 300);
      [3000, 8000, 20000].forEach((ms) => setTimeout(loadCredits, ms));
      setTimeout(() => { fetch("/api/credits").then((r) => r.json()).then((d) => { if (!d.account && !d.admin) setAuthOpen({ reason: "Purchase complete! Sign in with your email so your credits are safe on any device." }); }).catch(() => {}); }, 2500);
    }
    if (params.get("format") && FORMATS[params.get("format")]) { const f0 = params.get("format"); window.__ppVibe = true; setTimeout(() => selectFormat(f0), 0); params.delete("format"); window.history.replaceState(null, "", window.location.pathname + (params.toString() ? `?${params}` : "")); }
    if (params.get("vibe")) {
      const st = params.get("style"), ra = params.get("ratio"), ti = params.get("tier"), pr = params.get("p");
      if (pr) setPrompt(pr.slice(0, 1500));
      if (/^[0-9a-f-]{36}$/i.test(params.get("vibe"))) setRemixOf(params.get("vibe"));
      if (st && stylesList.includes(st)) setStyle(st);
      if (ra && ratiosList.some((r) => r.id === ra)) setAspectRatio(ra);
      if (ti && TIERS.some((t) => t.id === ti)) setTier(ti);
      window.__ppVibe = true;
      if (FORMATS[params.get("format")]) setFormat(params.get("format"));
      ["vibe", "style", "ratio", "tier", "p", "format"].forEach((k) => params.delete(k));
      const q = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""));
      setTimeout(() => { setToast("✦ Vibe loaded — describe your own idea"); setTimeout(() => setToast(""), 2600); document.getElementById("pp-prompt")?.focus(); }, 300);
    }
    const rpId = params.get("repaint"), rpSrc = params.get("src");
    if (rpId && rpSrc && /^https:\/\/[a-z0-9]+\.supabase\.co\//.test(rpSrc)) {
      setRepaintItem({ id: rpId, url: rpSrc });
      ["repaint", "src"].forEach((k) => params.delete(k));
      const q2 = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (q2 ? `?${q2}` : ""));
    }
    if (params.has("admin")) { params.delete("admin"); const qs = params.toString(); window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash); }
    loadCredits();
    // Upgrade legacy (unsigned) identity cookie before loading private history
    fetch("/api/session", { method: "POST" }).catch(() => {}).finally(loadHistory);
    loadFeed();
    loadDaily();
  }, []);

  useEffect(() => {
    if (activeTab === "community") { loadFeed(); loadDaily(); }
    try {
      const u = new URL(window.location.href);
      if (activeTab === "create") u.searchParams.delete("tab"); else u.searchParams.set("tab", activeTab);
      window.history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch {}
  }, [activeTab]);
  const [galleryKey, setGalleryKey] = useState(0);
  useEffect(() => { setGalleryKey((k) => k + 1); }, [history.length]);

  const handleSurpriseMe = () => {
    const random = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
    setPrompt(random);
  };

  const [ampOpen, setAmpOpen] = useState(false);
  const [ampIntensity, setAmpIntensity] = useState("bold");
  const [ampLoading, setAmpLoading] = useState(false);
  const [ampList, setAmpList] = useState([]);
  const runAmplify = async (intensity = ampIntensity) => {
    setAmpIntensity(intensity); setAmpOpen(true); setAmpLoading(true); setAmpList([]);
    try {
      const res = await fetch("/api/amplify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, intensity }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Amplify failed.");
      setAmpList(d.suggestions || []);
    } catch (e) { setAmpList([]); showToast(e.message); }
    finally { setAmpLoading(false); }
  };
  const handleEnhancePrompt = () => runAmplify();

  const promptState = prompt, styleState = style, ratioState = aspectRatio, tierState = tier, remixState = remixOf;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const showToast = (msg) => { setToast(msg); clearTimeout(window.__ppToast); window.__ppToast = setTimeout(() => setToast(""), 2600); };

  // Remember last composer choices
  useEffect(() => {
    try {
      const p = window.__ppVibe ? {} : JSON.parse(localStorage.getItem("pp_prefs") || "{}");
      if (p.tier && TIERS.some((t) => t.id === p.tier)) setTier(p.tier);
      if (p.style && stylesList.includes(p.style)) setStyle(p.style);
      if (p.aspectRatio && ratiosList.some((r) => r.id === p.aspectRatio)) setAspectRatio(p.aspectRatio);
      if (p.format && FORMATS[p.format]) setFormat(p.format);
    } catch {}
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    try { localStorage.setItem("pp_prefs", JSON.stringify({ tier, style, aspectRatio, format })); } catch {}
  }, [tier, style, aspectRatio, format, prefsLoaded]);

  const VARIATION_TWISTS = ["alternate composition", "different camera angle", "shifted color palette", "new lighting mood", "closer framing", "wider framing"];
  const handleVariation = (item) => {
    if (!item) return;
    const twist = VARIATION_TWISTS[Math.floor(Math.random() * VARIATION_TWISTS.length)];
    setActiveTab("create");
    generateImage({ guide: null, prompt: `${item.prompt}, ${twist}`, style: item.style || "Cinematic", aspectRatio: item.aspectRatio || "1:1", tier: safeTier(item.tier), remixOf: item.id || null });
  };
  const handleUsePrompt = (item) => {
    setPrompt(item.prompt || "");
    setActiveTab("create");
    showToast("Prompt loaded into the Pulse Bar");
    setTimeout(() => document.getElementById("pp-prompt")?.focus(), 50);
  };
  // Primary vibe action: load prompt + style + engine + shape, linked as a remix.
  const handlePulseVibe = (item) => {
    if (!item) return;
    setPrompt(item.prompt && item.prompt !== "Uploaded image" ? item.prompt : "");
    if (item.style && stylesList.includes(item.style)) setStyle(item.style);
    if (item.aspectRatio && ratiosList.some((r) => r.id === item.aspectRatio)) setAspectRatio(item.aspectRatio);
    if (item.tier && TIERS.some((t) => t.id === item.tier)) setTier(item.tier);
    setFormat(item.format && FORMATS[item.format] ? item.format : "free");
    setRemixOf(item.id || null);
    setActiveTab("create");
    showToast("✦ Vibe loaded — tweak it and Pulse");
    setTimeout(() => { const el = document.getElementById("pp-prompt"); el?.focus(); el?.setSelectionRange?.(el.value.length, el.value.length); }, 60);
  };
  const handleReport = async (item) => {
    const reason = window.prompt("Why are you reporting this image? (e.g. explicit, real person, hateful, copyright)", "");
    if (reason === null) return;
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, reason }) });
      const d = await r.json().catch(() => ({}));
      showToast(r.ok ? "⚑ Thanks — we'll review it" : (d.error || "Couldn't send report"));
    } catch { showToast("Couldn't send report"); }
  };
  const [modList, setModList] = useState(null);
  const loadModList = async () => {
    const r = await fetch("/api/admin/hide", { cache: "no-store" }); const d = await r.json().catch(() => ({}));
    setModList(r.ok ? d.items || [] : { error: d.error || "Unavailable" });
  };
  const adminHide = async (item, hidden) => {
    const r = await fetch("/api/admin/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, hidden }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { showToast(d.error || "Failed"); return; }
    if (hidden) setCommunityFeed((p) => p.filter((x) => x.id !== item.id)); else loadFeed();
    if (modList && Array.isArray(modList)) setModList((l) => l.map((x) => (x.id === item.id ? { ...x, hidden } : x)));
    showToast(hidden ? (d.fallback ? "Hidden (unpublished)" : "Hidden from feed") : "Back in the feed");
  };
  const copyPrompt = async (item) => {
    try { await navigator.clipboard.writeText(item.prompt || ""); showToast("✎ Prompt copied"); } catch { window.prompt("Copy prompt:", item.prompt || ""); }
  };

  const [repaintItem, setRepaintItem] = useState(null);
  const handleRepaintDone = (d, ok) => {
    syncCredits(d);
        if (typeof d.paid === "number") setPaid(d.paid); if (Array.isArray(d.plans)) setPlans(d.plans);
    if (!ok) return;
    const ni = toItem(d.item);
    setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
    setRepaintItem(null); setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
    window.scrollTo({ top: 0, behavior: "smooth" }); showToast("◐ Repainted");
  };
  const openRepaint = (item) => { if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; } setRepaintItem(item); };
  const EDIT_COST = 4;
  const [editTarget, setEditTarget] = useState(null); // { id, url }
  const attachEdit = (item) => {
    if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; }
    setGuide(null); setRemixOf(null); setEditTarget({ id: item.id, url: item.url, format: item.format || null }); setPrompt(""); setActiveTab("create");
    setTimeout(() => document.getElementById("pp-prompt")?.focus(), 60);
  };
  const runEdit = async () => {
    const instr = promptState.trim();
    if (!instr) { setError('Describe the change, e.g. "make it night".'); return; }
    if (!isAdmin && credits + paid < EDIT_COST) { openPricing("Edit", EDIT_COST); return; }
    setLoading(true); setError(""); setNotice(""); setLoadingText("Applying your edit...");
    try {
      const res = await fetch("/api/edit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editTarget.id, prompt: instr }) });
      const d = await res.json().catch(() => ({}));
      syncCredits(d);
        if (typeof d.paid === "number") setPaid(d.paid); if (Array.isArray(d.plans)) setPlans(d.plans);
      if (res.status === 402) { openPricing("Edit", EDIT_COST); return; }
      if (!res.ok || !d.item) throw new Error(d.error || "Edit failed.");
      const ni = { ...toItem(d.item), ...(editTarget.format ? { format: editTarget.format } : {}) };
      setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
      setImage(ni.url); setCurrentItem(ni); setGalleryKey((k) => k + 1);
      setEditTarget({ id: ni.id, url: ni.url, format: ni.format || null }); setPrompt("");
      showToast("✎ Edited — describe another change, or ✕ to finish");
    } catch (e) { setError(e.message); }
    finally { setLoading(false); setLoadingText("Initializing AI studio..."); }
  };
  const [guide, setGuide] = useState(null); // { id, url }
  const [guideFollow, setGuideFollow] = useState(55);
  const [uploading, setUploading] = useState(false);
  const GUIDED_COST = 3;
  const attachGuide = (item) => {
    if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; }
    setEditTarget(null); setGuide({ id: item.id, url: item.url }); setActiveTab("create");
    showToast("◎ Guide attached — describe the new image");
    setTimeout(() => document.getElementById("pp-prompt")?.focus(), 50);
  };
  const uploadLock = useRef(false);
  const handleUploadFile = async (file) => {
    if (!file || uploadLock.current) return;
    uploadLock.current = true;
    const uploadId = (crypto.randomUUID ? crypto.randomUUID() : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) => (c ^ (Math.random() * 16) >> (c / 4)).toString(16)));
    setUploading(true); setError("");
    try {
      const prep = await prepareUpload(file);
      let res;
      if (prep.data) {
        res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json", "x-upload-id": uploadId }, body: JSON.stringify({ data: prep.data }) });
      } else {
        showToast(prep.isHeic ? "Converting HEIC photo…" : "Converting photo on the server…");
        res = await uploadRaw(prep.raw, uploadId);
      }
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.item) throw new Error(d.error || (res.status === 413 ? "Photo is too large. Try a smaller one." : `Upload failed (${res.status}).`));
      const ni = toItem(d.item);
      setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
      setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
      showToast("⇪ Uploaded — edit, Repaint, Cutout or use as guide");
    } catch (e) { setError(e.message || "Upload failed."); }
    finally { setUploading(false); uploadLock.current = false; }
  };
  const [toolBusy, setToolBusy] = useState(""); // "<tool>:<id>"
  const handleShare = async (item) => {
    if (!item?.id) { showToast("Save failed for this image, can't share"); return; }
    if (!item.isPublic) { showToast("Publish it first to get a share link"); return; }
    const url = `${window.location.origin}/p/${item.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: "PixelPulse", text: (item.prompt || "").slice(0, 100), url }); return; } catch (e) { if (e?.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(url); showToast("↗ Link copied"); } catch { window.prompt("Copy link:", url); }
  };
  const handleTool = async (tool, item, opts = {}) => {
    if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; }
    if (toolBusy) return;
    if (tool === "sharpen" && !isAdmin && credits + paid < 1) { openPricing("HD download", 1); return; }
    setToolBusy(`${tool}:${item.id}`); setError("");
    showToast(tool === "sharpen" ? "◇ Preparing HD (2x)…" : "✂ Cutting out…");
    try {
      const res = await fetch(`/api/${tool}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const d = await res.json();
      syncCredits(d);
        if (typeof d.paid === "number") setPaid(d.paid); if (Array.isArray(d.plans)) setPlans(d.plans);
      if (res.status === 402) { openPricing(d.needCredits?.label || "This tool", d.needCredits?.cost || 1); return; }
      if (!res.ok || !d.item) throw new Error(d.error || "Failed.");
      const ni = { ...toItem(d.item), ...(opts.format ? { format: opts.format } : item.format ? { format: item.format } : {}) };
      setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
      setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (opts.replace && item.id && ni.id !== item.id) {
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
        fetch("/api/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [item.id] }) }).catch(() => {});
        setGalleryKey((k) => k + 1);
      }
      if (opts.download) { downloadImage(ni.url, fileName(ni)); showToast("⤓ HD image downloading (2x)"); return; }
      showToast(FORMATS[opts.format]?.autoCutout ? `✂ ${FORMATS[opts.format].label} ready — transparent PNG` : tool === "sharpen" ? "◇ Sharpened 2x" : "✂ Background removed");
    } catch (e) { setError(e.message); }
    finally { setToolBusy(""); }
  };

  const generateImage = async (ov = {}) => {
    const prompt = ov.prompt ?? promptState;
    const style = ov.style ?? styleState;
    const aspectRatio = ov.aspectRatio ?? ratioState;
    const tier = ov.tier ?? tierState;
    const remixOf = ov.remixOf !== undefined ? ov.remixOf : remixState;
    const useGuide = ov.guide !== undefined ? ov.guide : guide;
    const fmt = ov.format ?? format;
    const isDaily = ov.daily ?? dailyJoin;
    const tierCost = useGuide ? GUIDED_COST : (TIERS.find((t) => t.id === tier) || TIERS[0]).cost;
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }
    if (!isAdmin && credits + paid < tierCost) {
      openPricing(useGuide ? "Guide" : (TIERS.find((t) => t.id === tier) || TIERS[0]).label, tierCost);
      return;
    }

    setLoading(true);
    setError("");
    setImage(null);
    setNotice("");

    const textIntervals = [
      setTimeout(() => setLoadingText("Catching the pulse..."), 2000),
      setTimeout(() => setLoadingText("Tuning the frequency..."), 6000),
      setTimeout(() => setLoadingText("Rendering light & texture..."), 12000),
      setTimeout(() => setLoadingText("Almost there..."), 25000),
    ];

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, aspectRatio, remixOf, tier, format: fmt, ...(isDaily ? { daily: true } : {}), ...(useGuide ? { guideId: useGuide.id, guideFollow: guideFollow / 100 } : {}) }),
      });

      const data = await res.json();
      if (data.admin) setIsAdmin(true);
      else if (typeof data.credits === "number") setCredits(data.credits);
      if (typeof data.paid === "number") setPaid(data.paid);
      if (res.status === 402) { openPricing(data.needCredits?.label || "This", data.needCredits?.cost || tierCost); return; }

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate image.");
      }

      setImage(data.imageUrl);

      const newItem = {
        id: data.id || null,
        url: data.imageUrl,
        prompt: prompt.trim(),
        style,
        aspectRatio,
        tier: data.tier || tier,
        likes: 0,
        isPublic: false,
        remixOf: useGuide ? useGuide.id : remixOf,
        format: fmt !== "free" ? fmt : null,
        dailyDay: data.daily || null,
        persistError: data.stored ? null : (data.persistError || "unknown error"),
      };
      setCurrentItem(newItem);
      setRemixOf(null);
      if (data.daily) { setDailyJoin(false); showToast("◉ Daily entry made — Publish it to join the Pulse"); }
      if (FORMATS[fmt]?.autoCutout && data.id) setTimeout(() => handleTool("cutout", newItem, { format: fmt, replace: true }), 50);
      if (data.stored) {
        setHistory((prev) => [newItem, ...prev.filter((h) => h.id !== newItem.id)].slice(0, 24));
      } else {
        // Not stored in the cloud (Supabase missing or save failed): keep it in this browser
        setHistory((prev) => [newItem, ...prev].slice(0, 36));
        try {
          const saved = (JSON.parse(localStorage.getItem("pp_history") || "[]") || []).filter((h) => h && !h.id);
          localStorage.setItem("pp_history", JSON.stringify([newItem, ...saved].slice(0, 12)));
        } catch {}
        setNotice(`Cloud save failed (${newItem.persistError}). This image is kept only in this browser and can't be published. Download it to keep it.`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      textIntervals.forEach(clearTimeout);
      setLoading(false);
      setLoadingText("Initializing AI studio...");
    }
  };

  // Publish an image to the shared community feed
  const handlePublishToCommunity = async (item) => {
    if (!item?.id) {
      alert(`This image wasn't saved to the cloud, so it can't be published.\nReason: ${item?.persistError || "it was created before cloud saving was available or the save failed"}`);
      return;
    }
    if (item.isPublic) {
      showToast("Already live in the feed");
      return;
    }
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      showToast("◉ Safety check…");
      const d = await res.json();
      if (!res.ok) { showToast(""); setError(d.error || "Could not publish."); return false; }
      const mark = (x) => (x.id === item.id ? { ...x, isPublic: true } : x);
      setHistory((prev) => prev.map(mark));
      setCurrentItem((c) => (c && c.id === item.id ? { ...c, isPublic: true } : c));
      loadFeed();
      if (d.daily) {
        setStreak(d.daily.streak || 0);
        if (typeof d.daily.credits === "number") setCredits(d.daily.credits);
        showToast(`◉ You're in today's Pulse · 🔥${d.daily.streak}${d.daily.bonus ? ` · +${d.daily.bonus}⚡` : ""}`);
        loadDaily();
      } else showToast("🚀 Published to the Community Feed");
      return true;
    } catch (e) {
      alert(e.message);
      return false;
    }
  };

  const handleLike = async (item) => {
    if (!item.id || item.liked) return;
    setCommunityFeed((prev) => prev.map((x) => (x.id === item.id ? { ...x, liked: true, likes: x.likes + 1 } : x)));
    try {
      const res = await fetch("/api/like", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCommunityFeed((prev) => prev.map((x) => (x.id === item.id ? { ...x, liked: true, likes: d.likes } : x)));
    } catch {
      setCommunityFeed((prev) => prev.map((x) => (x.id === item.id ? { ...x, liked: false, likes: Math.max(0, x.likes - 1) } : x)));
    }
  };

  const curTier = TIERS.find((t) => t.id === tier) || TIERS[0];
  const curRatio = ratiosList.find((r) => r.id === aspectRatio) || ratiosList[0];
  const ratioBox = (id) => ({ "1:1": [16, 16], "9:16": [11, 18], "16:9": [20, 12] }[id] || [16, 16]);

  // Hide the image currently shown on the stage, and dedupe by id
  const shownHistory = (() => {
    const seen = new Set();
    return history.filter((h) => {
      if (image && (h.url === image || (currentItem?.id && h.id === currentItem.id))) return false;
      if (!h.id) return true;
      if (seen.has(h.id)) return false;
      seen.add(h.id); return true;
    });
  })();

  const recentList = (() => { const seen = new Set(); return history.filter((h) => !h.id || (!seen.has(h.id) && seen.add(h.id))).slice(0, 8); })();

  // Consistent actions: 3 primary + ⋯ sheet. ctx: "own" (Studio/history) | "feed"
  const buildActions = (item, ctx = "own", extra = []) => {
    const busyTool = (t) => toolBusy === `${t}:${item.id}`;
    const isUpload = item.tier === "upload";
    const A = {
      variation: { key: "var", icon: "≈", label: "Variation", onClick: () => handleVariation(item), disabled: loading, hint: "New take on the same idea & style" },
      vibe: { key: "vibe", icon: "✦", label: "Pulse this vibe", onClick: () => handlePulseVibe(item), hint: "Prompt + style into the Pulse Bar", tone: ctx === "feed" ? "accent" : undefined },
      edit: { key: "edit", icon: "✎", label: "Edit", onClick: () => attachEdit(item), disabled: !item.id || loading, hint: `${EDIT_COST}⚡ · change it with words` },
      copy: { key: "copy", icon: "⧉", label: "Copy prompt", onClick: () => copyPrompt(item) },
      repaint: { key: "repaint", icon: "◐", label: "Repaint", onClick: () => openRepaint(item), disabled: !!toolBusy || !item.id, hint: "5⚡ · paint an area" },
      guide: { key: "guide", icon: "◎", label: "Guide", onClick: () => attachGuide(item), disabled: !item.id, hint: "3⚡ · new image from it" },
      sharpen: { key: "sharpen", icon: busyTool("sharpen") ? "…" : "◇", label: "HD download", onClick: () => handleTool("sharpen", item, { download: true }), disabled: !!toolBusy || !item.id, hint: "1⚡ · 2x sharper file" },
      cutout: { key: "cutout", icon: busyTool("cutout") ? "…" : "✂", label: "Cutout", onClick: () => handleTool("cutout", item), disabled: !!toolBusy || !item.id, hint: "Free · remove background" },
      download: { key: "dl", icon: "⤓", label: "Download", onClick: () => downloadImage(item.url, fileName(item)) },
      share: { key: "share", icon: "↗", label: "Share", onClick: () => handleShare(ctx === "feed" ? { ...item, isPublic: true } : item) },
      card: { key: "card", icon: "▢", label: "Open Pulse Card", onClick: () => { window.location.href = `/p/${item.id}`; } },
      publish: { key: "pub", icon: item.isPublic ? "✓" : "◉", label: item.isPublic ? "Live" : "Publish", tone: item.isPublic ? "on" : "accent", onClick: () => handlePublishToCommunity(item), disabled: !item.id },
      like: { key: "like", icon: item.liked ? "♥" : "♡", label: String(item.likes || 0), tone: item.liked ? "liked" : undefined, onClick: () => handleLike(item), disabled: item.liked },
    };
    const report = { key: "report", icon: "⚑", label: "Report", hint: "Breaks the rules?", tone: "danger", onClick: () => handleReport(item) };
    const hide = isAdmin ? { key: "hide", icon: "⦸", label: "Hide (admin)", tone: "danger", onClick: () => adminHide(item, true) } : null;
    if (ctx === "feed") return { primary: [A.like, A.vibe], more: [A.edit, A.variation, A.copy, A.share, A.card, A.guide, A.repaint, A.download, A.sharpen, A.cutout, report, hide, ...extra] };
    if (isUpload) return { primary: [A.edit, A.repaint, A.download], more: [A.guide, A.sharpen, A.cutout, ...extra] };
    return {
      primary: [A.edit, A.variation, item.isPublic ? A.share : A.publish],
      more: [A.repaint, A.vibe, A.guide, A.cutout, A.download, A.sharpen, A.copy, item.isPublic ? A.card : null, ...extra],
    };
  };
  const Actions = ({ item, ctx = "own", compact, extra }) => { const a = buildActions(item, ctx, extra); return <ImageActions {...a} compact={compact} title={item.prompt} />; };

  // Profile / credits
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!menuOpen) return; const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [menuOpen]);
  const resetIn = (() => { const d = new Date(now); const next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1); const m = Math.max(0, Math.round((next - now) / 60000)); return `${Math.floor(m / 60)}h ${m % 60}m`; })();
  const STARTERS = [
    { icon: "🌌", text: "A lighthouse on a floating island above a sea of clouds at dawn" },
    { icon: "🐈", text: "Portrait of a fluffy cat wearing a tiny astronaut helmet, studio light" },
    { icon: "🏙️", text: "Rainy neon street market at night, reflections, cinematic" },
    { icon: "🍰", text: "Isometric miniature bakery made of candy, soft pastel colors" },
  ];
  const settingsSummary = `${editTarget ? "✎ Edit engine" : guide ? "◎ Guide engine" : `${curTier.icon} ${curTier.label}`} · ${style === "None" ? "No style" : style}${fmtDef.ratio ? "" : ` · ${aspectRatio}`}`;
  useEffect(() => { if (activeTab !== "community") return; setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, [activeTab]);
  const pulseIn = (() => { const m = Math.max(0, Math.round(((daily?.nextAt || 0) - now) / 60000)); return `${Math.floor(m / 60)}h ${m % 60}m`; })();
  const joinPulse = () => {
    if (!daily?.theme) return;
    selectFormat(daily.theme.format, true);
    setPrompt(daily.theme.text.replace(/"/g, "").trim() === daily.theme.text ? `${daily.theme.text}, ` : `${daily.theme.text}, `);
    setRemixOf(null); setGuide(null); setDailyJoin(true); setActiveTab("create"); setImage(null); setCurrentItem(null);
    showToast(`◉ Daily Pulse loaded · ${FORMATS[daily.theme.format].label}`);
    setTimeout(() => { const el = document.getElementById("pp-prompt"); el?.focus(); el?.setSelectionRange?.(el.value.length, el.value.length); }, 60);
  };
  const stageFmt = image ? (currentItem?.format || null) : (format !== "free" ? format : null);

  return (
    <div dir="ltr" className="pp-root">
      <style>{CSS + REPAINT_CSS + GALLERY_CSS + IA_CSS + THUMB_CSS}</style>
      <header className="pp-header">
        <div className="pp-brand">
          <div className={`pp-logo${loading ? " pp-beat" : ""}`}><span /></div>
          <h1>PixelPulse</h1>
        </div>
        <button className="pp-profile" onClick={() => setMenuOpen(true)} aria-label="Open menu">
          <span className="pp-avatar">◉</span>
          <b>{isAdmin ? "∞" : credits + paid}</b><small>{isAdmin ? "admin" : "⚡"}</small>
        </button>
      </header>

      <nav className="pp-tabs">
        <button className={activeTab === "create" ? "on" : ""} onClick={() => setActiveTab("create")}>Studio</button>
        <button className={activeTab === "community" ? "on" : ""} onClick={() => setActiveTab("community")}>Feed</button>
        <button className={activeTab === "me" ? "on" : ""} onClick={() => setActiveTab("me")}>My Pulses</button>
      </nav>

      <div className="pp-layout">
      {activeTab === "create" ? (
        <main className="pp-main">
          <section className={`pp-stage${loading ? " pp-generating" : ""}${stageFmt ? ` pp-fmt-${stageFmt}` : ""}${!image && !loading ? " pp-is-empty" : ""}`} style={{ aspectRatio: image && stageFmt !== "avatar" ? "auto" : (stageFmt === "avatar" ? "1 / 1" : aspectRatio.replace(":", " / ")) }}>
            {stageFmt === "wallpaper" && <div className="pp-lock" aria-hidden="true"><small>Thursday</small><b>09:41</b></div>}
            {loading ? (
              <div className="pp-ripple"><i /><i /><i /><b>{loadingText}</b></div>
            ) : image ? (
              <img src={image} alt="Generated AI Art" />
            ) : (
              <div className="pp-empty"><p>Type an idea and hit <b>Pulse</b> — or tap a spark ↓</p></div>
            )}
          </section>
          {image && currentItem && !loading && <Actions item={currentItem} />}
          {!image && !loading && (
            <section className="pp-start">
              <div className="pp-starters">
                {STARTERS.map((st) => (
                  <button key={st.text} className="pp-starter" onClick={() => { setPrompt(st.text); setRemixOf(null); setTimeout(() => document.getElementById("pp-prompt")?.focus(), 30); }}>
                    <b>{st.icon}</b><span>{st.text}</span>
                  </button>
                ))}
              </div>
              {communityFeed.length > 0 && (
                <>
                  <div className="pp-sechead"><h2>Pulse a vibe</h2><button className="pp-link" onClick={() => setActiveTab("community")}>Feed →</button></div>
                  <div className="pp-insp">
                    {communityFeed.slice(0, 9).map((x) => (
                      <button key={x.id} onClick={() => handlePulseVibe(x)} aria-label={`Use vibe: ${x.prompt}`}>
                        <Thumb src={x.url} ratio="1:1" /><span>✦ Pulse this</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}
          {notice && <div className="pp-notice">{notice}</div>}
          {error && <div className="pp-error">{error}</div>}

          {history.length > 0 && (
            <section className="pp-section">
              <div className="pp-sechead"><h2>Recent</h2>
                {storageEnabled ? <button className="pp-link" onClick={() => setActiveTab("me")}>See all →</button>
                  : <button className="pp-link" onClick={() => { setHistory([]); localStorage.removeItem("pp_history"); }}>Clear</button>}
              </div>
              <div className="pp-recent">
                {recentList.map((item, idx) => (
                  <button key={item.id || idx} className={image && item.url === image ? "on" : ""} onClick={() => { setImage(item.url); setCurrentItem(item); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                    <Thumb src={item.url} ratio="1:1" alt="" onFail={() => dropDeadLocal(item)} />
                  </button>
                ))}
                {storageEnabled && <button className="pp-seeall" onClick={() => setActiveTab("me")}>See all</button>}
              </div>
            </section>
          )}
        </main>
      ) : activeTab === "me" ? (
        <Gallery toItem={toItem} refreshKey={galleryKey} inspiration={communityFeed} tierLabel={tierLabel} notify={showToast}
          onStealVibe={handlePulseVibe}
          renderActions={(it, extra) => <Actions item={it} extra={extra} />}
          actions={{
            repaint: openRepaint, guide: attachGuide, edit: attachEdit, sharpen: (it) => handleTool("sharpen", it), cutout: (it) => handleTool("cutout", it),
            variation: handleVariation, usePrompt: handleUsePrompt, publish: handlePublishToCommunity, share: handleShare,
            open: (it) => { setActiveTab("create"); setImage(it.url); setCurrentItem(it); window.scrollTo({ top: 0 }); },
            onDeleted: (ids) => { const d = new Set(ids); setHistory((p) => p.filter((h) => !d.has(h.id))); if (currentItem && d.has(currentItem.id)) { setImage(null); setCurrentItem(null); } },
          }} />
      ) : (
        <main className="pp-main">
          {daily?.theme && (
            <section className="pp-daily">
              <div className="pp-dailyring" aria-hidden="true"><i /><i /><i /></div>
              <small className="pp-dk">◉ DAILY PULSE · {daily.day}</small>
              <h2>Today’s {FORMATS[daily.theme.format].label.toLowerCase()}: <span>{daily.theme.text}</span></h2>
              <div className="pp-dailymeta"><span>next pulse in {pulseIn}</span>{streak > 0 && <span>🔥{streak}</span>}<span>{daily.entries?.length || 0} entries</span></div>
              <button className="pp-join" onClick={joinPulse}>✦ Join the Pulse <em>+2⚡ bonus</em></button>
            </section>
          )}
          {daily?.winner && (
            <section className="pp-winner">
              <a href={`/p/${daily.winner.id}`}><Thumb src={daily.winner.public_url} ratio="1:1" alt={daily.winner.prompt} /></a>
              <div>
                <small>👑 Yesterday’s winner · “{daily.winner.theme}”</small>
                <p>“{daily.winner.prompt}”</p>
                <span className="pp-meta">♥ {daily.winner.likes || 0} · ⛓ {daily.winner.chain} in the chain</span>
                <button className="pp-chip on" onClick={() => handlePulseVibe(toItem({ ...daily.winner, is_public: true }))}>✦ Pulse this vibe</button>
              </div>
            </section>
          )}
          <div className="pp-seg">
            <button className={feedView === "latest" ? "on" : ""} onClick={() => setFeedView("latest")}>Latest</button>
            <button className={feedView === "daily" ? "on" : ""} onClick={() => setFeedView("daily")}>◉ Today’s top</button>
          </div>
          {feedView === "daily" ? (
            <>
              {(!daily?.entries || daily.entries.length === 0) && <p className="pp-muted">{daily?.migrated === false ? "Daily entries open very soon — create one now and it will count once entries are live." : "No entries yet. Be the first to join today’s Pulse!"}</p>}
              <div className="pp-grid pp-feed">
                {(daily?.entries || []).map((r0, idx) => { const item = toItem(r0); return (
                  <div className="pp-card" key={item.id}>
                    <a href={`/p/${item.id}`}><span className="pp-rank">{idx === 0 ? "👑" : `#${idx + 1}`}</span><Thumb src={item.url} ratio="1:1" alt={item.prompt} /></a>
                    <div className="pp-cardbody"><p>“{item.prompt}”</p><Actions item={item} ctx="feed" compact /></div>
                  </div>
                ); })}
              </div>
            </>
          ) : (<>
          <div className="pp-sechead"><h2>Pulse Feed</h2></div>
          {communityFeed.length === 0 && !feedLoading && <p className="pp-muted">{storageEnabled ? "No public creations yet. Be the first to publish!" : "The community feed is coming soon."}</p>}
          <div className="pp-grid pp-feed">
            {communityFeed.map((item, idx) => (
              <div className="pp-card" key={item.id || idx}>
                <a href={`/p/${item.id}`}><Thumb src={item.url} ratio="1:1" alt={item.prompt} eager={idx < 2} /></a>
                <div className="pp-cardbody">
                  <p>“{item.prompt}”</p>
                  <span className="pp-meta">{[item.style === "None" ? "No style" : item.style, tierLabel(item.tier), item.aspectRatio || "1:1", item.remixOf ? "Remix" : ""].filter(Boolean).join(" · ")}</span>
                  <Actions item={item} ctx="feed" compact />
                </div>
              </div>
            ))}
          </div>
          {feedCursor && <button className="pp-more" onClick={() => loadFeed(feedCursor)} disabled={feedLoading}>{feedLoading ? "Loading..." : "Load more"}</button>}
          </>)}
        </main>
      )}

      <footer className="pp-foot"><a href="/pricing">Pricing</a><a href="/formats">Formats</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund-policy">Refunds</a></footer>

      {/* Pulse Bar composer */}
      <div className="pp-dock">
        <div className={`pp-bar${loading ? " pp-generating" : ""}`}>
          {ampOpen && (
            <div className="pp-amp">
              <div className="pp-amphead">
                {["subtle", "bold", "wild"].map((k) => (
                  <button key={k} className={`pp-chip${ampIntensity === k ? " on" : ""}`} onClick={() => runAmplify(k)} disabled={ampLoading}>{{ subtle: "◌ Subtle", bold: "◉ Bold", wild: "✺ Wild" }[k]}</button>
                ))}
                <span className="pp-spacer" />
                <button className="pp-chip pp-ghost" onClick={() => setAmpOpen(false)} aria-label="Close">✕</button>
              </div>
              {ampLoading ? <div className="pp-ampwait"><i /><i /><i /> amplifying…</div> : (
                <div className="pp-amplist">
                  {ampList.map((sg, i) => (
                    <button key={i} className="pp-sugg" onClick={() => { setPrompt(sg); setAmpOpen(false); showToast("✦ Amplified prompt loaded"); }}>{sg}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          {editTarget && (
            <div className="pp-guide pp-editbar">
              <img src={editTarget.url} alt="" />
              <div className="pp-guidebody"><small>✎ Editing this image · {EDIT_COST}⚡</small><small style={{ color: "#a1a1b5" }}>Saved as a new image — the original stays</small></div>
              <button className="pp-chip pp-ghost" onClick={() => setEditTarget(null)} aria-label="Stop editing">✕</button>
            </div>
          )}
          {guide && (
            <div className="pp-guide">
              <img src={guide.url} alt="guide" />
              <div className="pp-guidebody">
                <small>◎ Guide engine · {GUIDED_COST}⚡ · follow <b>{guideFollow}%</b></small>
                <input type="range" min="0" max="100" value={guideFollow} onChange={(e) => setGuideFollow(+e.target.value)} aria-label="How closely to follow" />
              </div>
              <button className="pp-chip pp-ghost" onClick={() => setGuide(null)} aria-label="Remove guide">✕</button>
            </div>
          )}
          <div className="pp-chiprow">
            <label className={`pp-chip pp-upload${uploading ? " pp-generating" : ""}`} title="Upload a photo">
              {uploading ? "…" : "⇪"} <span>Upload</span>
              <input type="file" accept="image/*,.heic,.heif" hidden disabled={uploading} onChange={(e) => { handleUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button className={`pp-chip pp-fmtchip${format !== "free" ? " on" : ""}`} onClick={() => setSheetOpen(true)} aria-label="Format">{fmtDef.icon} <span>{fmtDef.label}</span></button>
            <button className="pp-chip pp-summary" onClick={() => setSheetOpen(true)} aria-label="Engine, style and shape">
              <span>{settingsSummary}</span><i>▾</i>
            </button>
            <button className="pp-chip pp-ghost pp-icon" onClick={handleSurpriseMe} title="Surprise me" aria-label="Surprise me">🎲</button>
          </div>
          {dailyJoin && daily?.theme && <div className="pp-remixnote pp-dailynote">◉ Daily Pulse · {FORMATS[daily.theme.format].label}: “{daily.theme.text}” <button className="pp-link" onClick={() => setDailyJoin(false)}>leave</button></div>}
          {remixOf && <div className="pp-remixnote">✦ Remixing a vibe <button className="pp-link" onClick={() => setRemixOf(null)}>clear</button></div>}
          <div className="pp-inputrow">
            <div className="pp-field">
              <textarea id="pp-prompt" maxLength={1500} rows={1} value={prompt} onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 820) { e.preventDefault(); editTarget ? runEdit() : generateImage(); } }}
                placeholder={editTarget ? "Describe the change — e.g. make it night" : "Describe a vision — any language…"} />
              {prompt.length > 1200 && <span className="pp-count" aria-live="polite">{prompt.length}/1500</span>}
              <button className={`pp-amp-btn${ampOpen ? " on" : ""}`} onClick={handleEnhancePrompt} title="Amplify prompt" aria-label="Amplify prompt">✦</button>
            </div>
            <button className="pp-go" onClick={() => (editTarget ? runEdit() : generateImage())} disabled={loading}>
              <span className="pp-go-label">{loading ? <i className="pp-spin" /> : "Pulse"}</span>
              <span className="pp-cost">{isAdmin ? "∞" : `${editTarget ? EDIT_COST : guide ? GUIDED_COST : curTier.cost}⚡`}</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {sheetOpen && (
        <div className="pp-scrim" onClick={() => setSheetOpen(false)}>
          <div className="pp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pp-grab" />
            <h3>Format</h3>
            <input className="pp-fmtsearch" type="search" placeholder="Search 30 formats — logo, thumbnail, tattoo…" value={fmtQuery} onChange={(e) => setFmtQuery(e.target.value)} aria-label="Search formats" />
            {Object.entries(FORMAT_GROUPS).map(([g, gl]) => {
              const q = fmtQuery.trim().toLowerCase();
              const list = FORMAT_LIST.filter((f) => f.group === g && (!q || `${f.label} ${f.blurb}`.toLowerCase().includes(q)));
              if (!list.length) return null;
              return (
                <div key={g} className="pp-fmtgroup">
                  <small>{gl}</small>
                  <div className="pp-fmtrow">
                    {g === "Social" && !q && <button className={`pp-chip${format === "free" ? " on" : ""}`} onClick={() => selectFormat("free", true)}>◌ Any</button>}
                    {list.map((f) => <button key={f.id} title={f.blurb} className={`pp-chip${format === f.id ? " on" : ""}`} onClick={() => selectFormat(f.id, true)}>{f.icon} {f.label}</button>)}
                  </div>
                </div>
              );
            })}
            {format !== "free" && <p className="pp-sheetnote">{fmtDef.ratio} frame · recommended engine set{fmtDef.autoCutout ? " · auto Cutout is free" : ""} · <a className="pp-link" href={`/formats/${format}`}>About {fmtDef.label}</a></p>}
            <h3>Engine</h3>
            {editTarget && <p className="pp-sheetnote">✎ Editing an image uses the Edit engine ({EDIT_COST}⚡). <button className="pp-link" onClick={() => setEditTarget(null)}>Stop editing</button> to pick an engine.</p>}
            {!editTarget && guide && <p className="pp-sheetnote">◎ A guide image is attached, so the Guide engine ({GUIDED_COST}⚡) is used. <button className="pp-link" onClick={() => setGuide(null)}>Remove guide</button> to pick an engine.</p>}
            <div className="pp-chips" style={guide || editTarget ? { opacity: .4, pointerEvents: "none" } : undefined} aria-disabled={!!(guide || editTarget)}>
              {TIERS.map((t) => (
                <button key={t.id} disabled={!!(guide || editTarget)} className={`pp-chip pp-big${tier === t.id && !guide && !editTarget ? " on" : ""}`} onClick={() => setTier(t.id)}>
                  <b>{t.icon} {t.label}</b><small>{t.desc} · {t.cost}⚡</small>
                </button>
              ))}
            </div>
            <h3>Style</h3>
            <div className="pp-chips">
              {stylesList.map((s) => <button key={s} className={`pp-chip${style === s ? " on" : ""}`} onClick={() => setStyle(s)}>{s === "None" ? "∅ No style" : s}</button>)}
            </div>
            <h3>Shape</h3>
            <div className="pp-chips">
              {ratiosList.map((r) => (
                <button key={r.id} disabled={!!fmtDef.ratio && fmtDef.ratio !== r.id} className={`pp-chip pp-big${aspectRatio === r.id ? " on" : ""}`} onClick={() => setAspectRatio(r.id)}>
                  <i className="pp-ar" style={{ width: ratioBox(r.id)[0] * 1.4, height: ratioBox(r.id)[1] * 1.4 }} /><small>{r.label}</small>
                </button>
              ))}
            </div>
            <p className="pp-sheetnote">Your choices are remembered as defaults on this device.</p>
            <button className="pp-done" onClick={() => setSheetOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {authOpen && <AuthSheet reason={authOpen.reason} onClose={() => setAuthOpen(null)} onSignedIn={() => { setAuthOpen(null); window.location.replace("/?signedin=1"); }} />}
      {pricing && <PricingModal signedIn={!!account} onSignIn={() => { setPricing(null); setAuthOpen({ reason: "Sign in first so the credits you buy are safe on every device." }); }} need={pricing.need} credits={credits} paid={paid} resetIn={resetIn} plans={plans} onClose={() => setPricing(null)} />}
      {repaintItem && <RepaintEditor item={repaintItem} isAdmin={isAdmin} credits={credits + paid} onNeedCredits={() => { setRepaintItem(null); openPricing("Repaint", 5); }} onClose={() => setRepaintItem(null)} onDone={handleRepaintDone} />}
      {menuOpen && (
        <div className="pp-scrim pp-menuscrim" onClick={() => setMenuOpen(false)}>
          <aside className="pp-menu" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="pp-menuhead">
              <span className="pp-avatar pp-avatar-lg">◉</span>
              <div><b>{account ? account.email : "Guest pulser"}</b><small>{isAdmin ? "Admin mode · unlimited" : account ? "Signed in · synced across devices" : "Anonymous · saved on this device"}</small></div>
              <button className="pp-chip pp-ghost pp-icon" onClick={() => setMenuOpen(false)} aria-label="Close">✕</button>
            </div>
            <div className="pp-creditcard">
              {isAdmin ? <><b>∞</b><span>Admin · credits not counted</span></> : <>
                <b>{credits}<small>/10</small></b>
                <span>credits left today<br /><em>resets in {resetIn}</em>{paid > 0 && <><br /><em>+ {paid}⚡ paid balance</em></>}</span>
              </>}
              <div className="pp-creditbar"><i style={{ width: isAdmin ? "100%" : `${Math.min(100, (credits / 10) * 100)}%` }} /></div>
              {!isAdmin && <button className="pp-chip pp-getcr" onClick={() => { setMenuOpen(false); openPricing(); }}>⚡ Get more credits</button>}
              {!account && <button className="pp-chip pp-signin" onClick={() => { setMenuOpen(false); setAuthOpen({}); }}>✉ Sign in with email</button>}
              {!isAdmin && <div className="pp-restore">
                {paid > 0 && <button className="pp-link" onClick={copyRestoreCode}>Copy purchase restore code</button>}
                <button className="pp-link" onClick={restorePurchase}>Restore a purchase</button>
                {account && <button className="pp-link" onClick={signOut}>Sign out</button>}
              </div>}
              {isAdmin && account && <div className="pp-restore"><button className="pp-link" onClick={signOut}>Sign out</button></div>}
            </div>
            <div className="pp-streak"><b>🔥{streak}</b><span>{streak ? `day${streak === 1 ? "" : "s"} Daily Pulse streak` : "Join today's Daily Pulse to start a streak"}</span><button className="pp-chip" onClick={() => { setMenuOpen(false); setActiveTab("community"); }}>◉ Daily</button></div>
            <nav className="pp-menulist">
              <button onClick={() => { setMenuOpen(false); setActiveTab("me"); }}><b>▦</b>My Pulses</button>
              <button onClick={() => { setMenuOpen(false); setSheetOpen(true); }}><b>⚙</b>Settings<small>Default engine, style & shape</small></button>
              {isAdmin && <button onClick={loadModList}><b>⚑</b>Moderation<small>Reported & hidden feed images</small></button>}
              {isAdmin && modList && (Array.isArray(modList) ? (
                <div className="pp-modlist">
                  {modList.length === 0 && <p>No reports. 🎉</p>}
                  {modList.map((x) => (
                    <div key={x.id} className="pp-moditem">
                      <a href={`/p/${x.id}`}><Thumb src={x.public_url} ratio="1:1" /></a>
                      <span>⚑ {x.report_count} · {x.hidden ? "hidden" : "visible"}</span>
                      <button className="pp-chip" onClick={() => adminHide(x, !x.hidden)}>{x.hidden ? "Unhide" : "Hide"}</button>
                      {x.report_count > 0 && <button className="pp-chip" onClick={async () => { await fetch("/api/admin/hide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: x.id, resetReports: true }) }); setModList((l) => l.map((y) => (y.id === x.id ? { ...y, report_count: 0 } : y))); }}>Clear</button>}
                    </div>
                  ))}
                </div>
              ) : <p className="pp-modnote">{modList.error}</p>)}
            </nav>
            <div className="pp-legal"><a href="/pricing">Pricing</a><a href="/contact">Contact</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refund-policy">Refunds</a><a href="/content-policy">Content Policy</a></div>
          </aside>
        </div>
      )}

      {toast && <div className="pp-toast" key={toast}>{toast}</div>}
    </div>
  );
}

const CSS = `
:root{--bg:#07070a;--panel:#101018;--line:#1f1f2e;--v:#9333ea;--v2:#a855f7;--p:#ec4899;--txt:#e9e7f5;--mut:#7c7c94}
body{margin:0;background:var(--bg)}
.pp-count{position:absolute;right:44px;bottom:4px;font-size:10px;color:var(--mut);pointer-events:none}
.pp-root{min-height:100vh;background:radial-gradient(1200px 500px at 50% -200px,rgba(147,51,234,.18),transparent),var(--bg);color:var(--txt);font-family:system-ui,-apple-system,sans-serif;padding:16px 14px 190px;box-sizing:border-box}
.pp-root *{box-sizing:border-box}
.pp-root button{font-family:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.pp-root button:disabled{opacity:.5;cursor:default}
.pp-header{max-width:1100px;margin:0 auto 14px;display:flex;justify-content:space-between;align-items:center}
.pp-brand{display:flex;gap:10px;align-items:center}
.pp-brand h1{margin:0;font-size:21px;font-weight:800;letter-spacing:-.5px;background:linear-gradient(90deg,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pp-brand small{font-size:10px;color:var(--mut);letter-spacing:.08em}
.pp-logo{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--v),var(--p));display:grid;place-items:center;box-shadow:0 0 18px rgba(147,51,234,.55);position:relative}
.pp-logo span{width:10px;height:10px;border-radius:50%;background:#fff}
.pp-logo::after{content:"";position:absolute;inset:0;border-radius:50%;border:2px solid rgba(236,72,153,.7);animation:ppRing 2.8s ease-out infinite}
.pp-beat::after{animation-duration:.9s}
.pp-credits{padding:7px 14px;border-radius:999px;background:#12121c;border:1px solid #2a2a40;color:#d8b4fe;font-size:13px;font-weight:700}
.pp-tabs{max-width:1100px;margin:0 auto 16px;display:flex;gap:6px}
.pp-tabs button{border:1px solid var(--line);background:transparent;color:var(--mut);padding:8px 16px;border-radius:999px;font-weight:700;font-size:13px;transition:all .2s}
.pp-tabs button.on{background:var(--txt);color:#0b0b12;border-color:var(--txt)}
.pp-tabs em{font-style:normal;opacity:.6;margin-left:4px}
.pp-layout{max-width:1100px;margin:0 auto}
.pp-main{width:100%}
.pp-stage{width:100%;max-width:560px;margin:0 auto;border-radius:28px;background:var(--panel);border:1px solid var(--line);overflow:hidden;display:grid;place-items:center;max-height:70vh;position:relative;transition:box-shadow .4s}
.pp-stage img{max-width:100%;max-height:58vh;width:auto;height:auto;display:block;margin:0 auto;animation:ppReveal .6s ease}
.pp-generating{box-shadow:0 0 0 1px rgba(168,85,247,.6),0 0 40px rgba(168,85,247,.35);animation:ppGlow 1.6s ease-in-out infinite}
.pp-empty{text-align:center;color:var(--mut);font-size:14px;padding:30px}
.pp-stage.pp-is-empty:not([class*="pp-fmt-"]){aspect-ratio:auto!important;border-style:dashed;background:transparent}
.pp-stage.pp-is-empty:not([class*="pp-fmt-"]) .pp-empty{padding:12px 14px;font-size:13px}
.pp-stage.pp-is-empty:not([class*="pp-fmt-"]){height:auto!important;min-height:0}
.pp-ripple{position:relative;width:160px;height:160px;display:grid;place-items:center}
.pp-ripple i{position:absolute;inset:40px;border-radius:50%;border:2px solid var(--v2);animation:ppRipple 2.1s ease-out infinite;opacity:0}
.pp-ripple i:nth-child(2){animation-delay:.7s;border-color:var(--p)}
.pp-ripple i:nth-child(3){animation-delay:1.4s}
.pp-ripple b{position:relative;font-size:12px;font-weight:600;color:#d8b4fe;text-align:center;max-width:150px}
.pp-idle i{animation-duration:3.4s}
.pp-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:560px;margin:12px auto 0}
.pp-cap{display:inline-flex;align-items:center;gap:6px;padding:8px 13px;border-radius:999px;border:1px solid #2a2a40;background:#151520;color:var(--txt);font-size:13px;font-weight:600;transition:transform .12s,background .2s}
.pp-cap:active{transform:scale(.92)}
.pp-cap:hover:not(:disabled){background:#1d1d2c}
.pp-accent{background:linear-gradient(90deg,rgba(147,51,234,.35),rgba(236,72,153,.35));border-color:rgba(236,72,153,.5)}
.pp-on{border-color:rgba(52,211,153,.5);color:#6ee7b7}
.pp-liked{color:#f9a8d4;border-color:rgba(236,72,153,.5)}
.pp-vibe{background:linear-gradient(90deg,#9333ea,#ec4899);border-color:transparent;color:#fff}
.pp-compact{justify-content:flex-start;margin-top:8px;gap:5px}
.pp-compact .pp-cap{padding:5px 9px;font-size:11px;gap:4px}
.pp-notice{max-width:560px;margin:12px auto 0;padding:10px 14px;border-radius:16px;background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.4);color:#fde68a;font-size:13px}
.pp-error{max-width:560px;margin:12px auto 0;padding:10px 14px;border-radius:16px;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.4);color:#f87171;font-size:13px;text-align:center}
.pp-section{margin-top:30px}
.pp-sechead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.pp-sechead h2{font-size:16px;margin:0}
.pp-link{background:none;border:none;color:var(--mut);text-decoration:underline;font-size:12px}
.pp-muted{color:var(--mut);font-size:13px;text-align:center}
.pp-grid{display:grid;grid-template-columns:1fr;gap:14px}
.pp-card{background:var(--panel);border:1px solid var(--line);border-radius:22px;overflow:hidden}
.pp-card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block;cursor:pointer}
.pp-cardbody{padding:12px}
.pp-cardbody p{margin:0 0 4px;font-size:13px;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pp-meta{font-size:11px;color:var(--mut)}
.pp-more{display:block;margin:16px auto;padding:10px 22px;border-radius:999px;background:var(--panel);border:1px solid var(--line);color:var(--txt)}
.pp-dock{position:fixed;left:0;right:0;bottom:0;padding:10px 10px calc(10px + env(safe-area-inset-bottom));background:linear-gradient(transparent,rgba(7,7,10,.92) 30%);z-index:20}
.pp-bar{max-width:640px;margin:0 auto;background:rgba(18,18,28,.92);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border:1px solid #2c2c44;border-radius:28px;padding:8px;box-shadow:0 12px 40px rgba(0,0,0,.6)}
.pp-chiprow{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 8px;scrollbar-width:none}
.pp-chiprow::-webkit-scrollbar{display:none}
.pp-spacer{flex:1}
.pp-chip{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;padding:6px 12px;border-radius:999px;border:1px solid #2a2a40;background:#161622;color:#cfcde0;font-size:12px;font-weight:600;transition:all .15s}
.pp-chip:active{transform:scale(.94)}
.pp-chip.on{background:linear-gradient(90deg,var(--v),var(--p));border-color:transparent;color:#fff;box-shadow:0 0 16px rgba(168,85,247,.45)}
.pp-ghost{background:transparent}
.pp-ar{display:inline-block;border:2px solid currentColor;border-radius:4px}
.pp-inputrow{display:flex;align-items:flex-end;gap:8px}
.pp-tune{width:42px;height:42px;flex:none;border-radius:50%;border:1px solid #2a2a40;background:#161622;color:#d8b4fe;font-size:18px}
.pp-inputrow textarea{flex:1;min-height:42px;max-height:120px;resize:none;border:none;outline:none;background:transparent;color:#fff;font-size:16px;line-height:1.4;padding:10px 4px;font-family:inherit;field-sizing:content}
.pp-go{flex:none;height:42px;padding:0 6px 0 16px;border-radius:999px;border:none;background:linear-gradient(90deg,var(--v),var(--p));color:#fff;font-weight:800;font-size:14px;display:flex;align-items:center;gap:8px;box-shadow:0 6px 20px rgba(236,72,153,.35);position:relative}
.pp-go:not(:disabled){animation:ppBreathe 3s ease-in-out infinite}
.pp-cost{background:rgba(0,0,0,.28);border-radius:999px;padding:5px 9px;font-size:12px}
.pp-scrim{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:40;display:flex;align-items:flex-end;justify-content:center;animation:ppFade .2s}
.pp-sheet{width:100%;max-width:640px;background:#11111a;border:1px solid #2a2a40;border-bottom:none;border-radius:28px 28px 0 0;padding:10px 18px calc(18px + env(safe-area-inset-bottom));animation:ppUp .28s cubic-bezier(.2,.9,.3,1.2);max-height:85vh;overflow:auto}
.pp-grab{width:42px;height:5px;border-radius:9px;background:#33334a;margin:0 auto 6px}
.pp-sheet h3{font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin:16px 0 8px}
.pp-chips{display:flex;flex-wrap:wrap;gap:8px}
.pp-big{flex-direction:column;gap:4px;padding:10px 16px;border-radius:20px;min-width:92px}
.pp-big small{font-size:10px;opacity:.8;font-weight:500}
.pp-done{width:100%;margin-top:20px;padding:13px;border-radius:999px;border:none;background:var(--txt);color:#0b0b12;font-weight:800;font-size:15px}
.pp-toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);background:#1d1830;border:1px solid rgba(236,72,153,.5);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;font-weight:600;z-index:50;box-shadow:0 0 24px rgba(168,85,247,.45);animation:ppPop .35s cubic-bezier(.2,.9,.3,1.4);white-space:nowrap;max-width:92vw;overflow:hidden;text-overflow:ellipsis}
.pp-upload{cursor:pointer;border-style:dashed;border-color:rgba(236,72,153,.55);color:#f9a8d4}
.pp-guide{display:flex;align-items:center;gap:10px;padding:6px;margin-bottom:8px;border-radius:999px;background:linear-gradient(90deg,rgba(147,51,234,.18),rgba(236,72,153,.12));border:1px solid rgba(236,72,153,.4);animation:ppFade .2s}
.pp-guide img{width:38px;height:38px;border-radius:50%;object-fit:cover;flex:none;box-shadow:0 0 0 2px rgba(236,72,153,.6)}
.pp-guidebody{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.pp-guidebody small{font-size:11px;color:#e9d5ff}
.pp-guidebody input{width:100%;accent-color:#ec4899}
.pp-amp{border-bottom:1px solid #2a2a40;margin:0 0 8px;padding:2px 2px 8px;animation:ppFade .2s}
.pp-amphead{display:flex;gap:6px;align-items:center;margin-bottom:8px}
.pp-amplist{display:flex;flex-direction:column;gap:6px;max-height:38vh;overflow:auto}
.pp-sugg{text-align:left;padding:9px 14px;border-radius:20px;border:1px solid rgba(168,85,247,.35);background:linear-gradient(90deg,rgba(147,51,234,.14),rgba(236,72,153,.1));color:var(--txt);font-size:12.5px;line-height:1.4}
.pp-sugg:active{transform:scale(.98)}
.pp-ampwait{display:flex;align-items:center;gap:5px;color:#d8b4fe;font-size:12px;padding:6px}
.pp-ampwait i{width:7px;height:7px;border-radius:50%;background:var(--p);animation:ppBreathe 1s infinite,ppDot 1s ease-in-out infinite}
.pp-ampwait i:nth-child(2){animation-delay:.15s}.pp-ampwait i:nth-child(3){animation-delay:.3s}
@keyframes ppDot{50%{transform:scale(.4);opacity:.4}}
.pp-header{max-width:1100px;margin:0 auto 12px;display:flex;justify-content:space-between;align-items:center;min-height:48px}
.pp-brand h1{font-size:22px}
.pp-profile{display:flex;align-items:center;gap:6px;height:44px;padding:0 12px 0 4px;border-radius:999px;border:1px solid #2a2a40;background:#12121c;color:#e9d5ff}
.pp-profile b{font-size:15px}.pp-profile small{font-size:11px;color:var(--mut)}
.pp-avatar{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#2a1748,#3b1230);color:#f0abfc;font-size:16px;box-shadow:inset 0 0 0 1px rgba(236,72,153,.45)}
.pp-avatar-lg{width:48px;height:48px;font-size:22px}
.pp-tabs{gap:4px;padding:4px;border-radius:999px;background:#0e0e16;border:1px solid var(--line);width:fit-content;max-width:100%}
.pp-tabs button{min-height:40px;padding:0 18px;border:none;font-size:14px}
.pp-tabs button.on{background:linear-gradient(90deg,var(--v),var(--p));color:#fff;box-shadow:0 0 18px rgba(168,85,247,.4)}
.pp-start{max-width:560px;margin:16px auto 0}
.pp-starters{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:22px}
.pp-starter{display:flex;gap:8px;align-items:flex-start;text-align:left;min-height:64px;padding:10px 12px;border-radius:20px;border:1px solid #2a2a40;background:linear-gradient(160deg,#141420,#101018);color:#cfcde0;font-size:12px;line-height:1.35}
.pp-starter b{font-size:18px;line-height:1}
.pp-starter span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.pp-starter:active{transform:scale(.97);border-color:rgba(236,72,153,.6)}
.pp-insp{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.pp-insp button{position:relative;padding:0;border:none;border-radius:16px;overflow:hidden;aspect-ratio:1;background:#101018}
.pp-insp img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.pp-insp button:active img{transform:scale(1.06)}
.pp-insp span{position:absolute;left:6px;right:6px;bottom:6px;font-size:10.5px;font-weight:700;color:#fff;background:rgba(147,51,234,.78);border-radius:999px;padding:4px 0;backdrop-filter:blur(4px)}
.pp-chiprow{align-items:center}
.pp-chip{min-height:36px}
.pp-summary{flex:1;min-width:0;justify-content:space-between}
.pp-summary span{overflow:hidden;text-overflow:ellipsis}
.pp-summary i{font-style:normal;opacity:.6}
.pp-icon{width:40px;justify-content:center;padding:0}
.pp-remixnote{font-size:11px;color:#f0abfc;padding:0 6px 6px;display:flex;gap:8px;align-items:center}
.pp-field{position:relative;flex:1;display:flex;align-items:flex-end;min-width:0;background:#0b0b12;border:1px solid #23233a;border-radius:22px;padding-right:4px}
.pp-field textarea{flex:1;min-width:0;padding-left:14px!important}
.pp-amp-btn{flex:none;width:36px;height:36px;margin:3px 0;border-radius:50%;border:none;background:linear-gradient(135deg,rgba(147,51,234,.35),rgba(236,72,153,.35));color:#fff;font-size:15px}
.pp-amp-btn.on{background:linear-gradient(135deg,var(--v),var(--p));box-shadow:0 0 14px rgba(236,72,153,.6)}
.pp-go{height:44px;min-width:96px}
.pp-spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:ppSpin .8s linear infinite}
@keyframes ppSpin{to{transform:rotate(360deg)}}
.pp-sheetnote{font-size:11px;color:var(--mut);text-align:center;margin:16px 0 0}
.pp-menuscrim{align-items:stretch;justify-content:flex-end}
.pp-menu{width:min(340px,88vw);height:100%;background:#0f0f18;border-left:1px solid #2a2a40;padding:calc(16px + env(safe-area-inset-top)) 16px 20px;display:flex;flex-direction:column;gap:16px;animation:ppSlide .26s cubic-bezier(.2,.9,.3,1.1);overflow:auto}
@keyframes ppSlide{from{transform:translateX(100%)}}
.pp-menuhead{display:flex;align-items:center;gap:10px}
.pp-menuhead div{flex:1;display:flex;flex-direction:column}
.pp-menuhead small{font-size:11px;color:var(--mut)}
.pp-creditcard{position:relative;padding:16px;border-radius:22px;background:radial-gradient(260px 120px at 0 0,rgba(147,51,234,.35),transparent),#151522;border:1px solid rgba(168,85,247,.35);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.pp-creditcard>b{font-size:34px;line-height:1;background:linear-gradient(90deg,#c084fc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pp-creditcard>b small{font-size:14px}
.pp-creditcard span{font-size:12px;color:#cfcde0}
.pp-fmtsearch{width:100%;padding:10px 14px;border-radius:999px;border:1px solid var(--line);background:#0e0e16;color:#fff;font-size:14px;margin:2px 0 8px;outline:none}
.pp-fmtsearch:focus{border-color:rgba(236,72,153,.6)}
.pp-fmtgroup>small{display:block;font-size:11px;color:var(--mut);margin:6px 2px 4px;text-transform:uppercase;letter-spacing:.06em}
.pp-fmtrow{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:none}
.pp-fmtrow::-webkit-scrollbar{display:none}
.pp-fmtrow .pp-chip{flex:none;white-space:nowrap}
.pp-creditcard em{font-style:normal;color:var(--mut)}
.pp-getcr{margin-top:10px;width:100%;justify-content:center;background:linear-gradient(90deg,rgba(147,51,234,.35),rgba(236,72,153,.3));border-color:rgba(236,72,153,.5);color:#fff;font-weight:700}
.pp-signin{margin-top:8px;width:100%;justify-content:center}
.pp-restore{display:flex;gap:14px;justify-content:center;margin-top:8px;font-size:12px}
.pp-creditbar{flex-basis:100%;height:6px;border-radius:9px;background:#22223a;overflow:hidden}
.pp-creditbar i{display:block;height:100%;background:linear-gradient(90deg,var(--v),var(--p));border-radius:9px}
.pp-menulist{display:flex;flex-direction:column;gap:6px}
.pp-menulist button{display:flex;align-items:center;gap:12px;min-height:52px;padding:0 14px;border-radius:18px;border:1px solid #23233a;background:#141420;color:var(--txt);font-size:14.5px;font-weight:600;text-align:left;flex-wrap:wrap}
.pp-menulist button b{width:22px;text-align:center;color:#d8b4fe}
.pp-menulist small{flex-basis:100%;margin:-10px 0 8px 34px;font-size:11px;color:var(--mut);font-weight:500}
.pp-menulist em{margin-left:auto;font-style:normal;font-size:10px;padding:3px 8px;border-radius:999px;background:#22223a;color:var(--mut)}
.pp-menulist button:disabled{opacity:.65}
.pp-modlist{display:flex;flex-direction:column;gap:6px;padding:4px 0}
.pp-modlist p,.pp-modnote{font-size:12px;color:var(--mut);margin:4px 6px}
.pp-moditem{display:flex;align-items:center;gap:10px;font-size:12px;color:#cfcde0}
.pp-moditem img{width:44px;height:44px;border-radius:12px;object-fit:cover}
.pp-moditem span{flex:1}
.pp-fmtchip{flex:0 0 auto}.pp-fmtchip.on{border-color:rgba(236,72,153,.7);color:#fff;background:rgba(236,72,153,.14)}
.pp-fmts{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.pp-fmt{display:flex;flex-direction:column;align-items:center;gap:4px;padding:12px 6px;border-radius:20px;border:1px solid var(--line);background:#12121c;color:var(--txt);font-family:inherit;cursor:pointer;text-align:center}
.pp-fmt b{font-size:13px}.pp-fmt small{font-size:10.5px;color:var(--mut);line-height:1.3}
.pp-fmt.on{border-color:var(--p);background:linear-gradient(180deg,rgba(147,51,234,.22),rgba(236,72,153,.1));box-shadow:0 0 0 1px rgba(236,72,153,.4)}
.pp-fmtshape{display:grid;place-items:center;font-style:normal;font-size:13px;width:26px;height:26px;border:2px solid #4a4a66;border-radius:8px;color:#f0abfc}
.pp-fs-wallpaper,.pp-fs-story,.pp-fs-poster{width:18px;height:30px;border-radius:6px}.pp-fs-avatar{border-radius:50%}.pp-fs-sticker{border-style:dashed}
.pp-fmt.on .pp-fmtshape{border-color:var(--p)}
.pp-chip:disabled{opacity:.35}
.pp-stage.pp-fmt-wallpaper{max-width:280px;margin-left:auto;margin-right:auto;border:9px solid #1a1a26;border-radius:42px;box-shadow:0 0 0 1px #33334a,0 18px 50px rgba(147,51,234,.25);position:relative}
.pp-stage.pp-fmt-wallpaper::before{content:"";position:absolute;top:8px;left:50%;transform:translateX(-50%);width:70px;height:20px;border-radius:99px;background:#050507;z-index:3}
.pp-lock{position:absolute;top:34px;left:0;right:0;text-align:center;z-index:2;pointer-events:none;color:#fff;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.pp-lock small{display:block;font-size:12px;opacity:.85}.pp-lock b{font-size:46px;font-weight:300;letter-spacing:-.02em}
.pp-stage.pp-fmt-avatar{max-width:300px;margin-left:auto;margin-right:auto;border-radius:50%;box-shadow:0 0 0 3px rgba(236,72,153,.55),0 0 0 10px rgba(147,51,234,.14)}
.pp-stage.pp-fmt-avatar img{width:100%;height:100%;object-fit:cover;max-height:none}
.pp-stage.pp-fmt-sticker{background:repeating-conic-gradient(#191926 0 25%,#12121c 0 50%) 0 0/22px 22px}
.pp-stage.pp-fmt-story,.pp-stage.pp-fmt-poster{max-width:320px;margin-left:auto;margin-right:auto}
.pp-dailynote{border-color:rgba(236,72,153,.5)!important;color:#f9a8d4}
.pp-daily{position:relative;overflow:hidden;padding:18px 16px 16px;border-radius:28px;background:radial-gradient(420px 220px at 100% 0,rgba(236,72,153,.28),transparent),linear-gradient(160deg,#1a1030,#0f0f19);border:1px solid rgba(168,85,247,.35);margin-bottom:12px}
.pp-daily h2{font-size:21px;line-height:1.25;margin:6px 0 10px;max-width:85%}.pp-daily h2 span{background:linear-gradient(90deg,#f0abfc,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.pp-dk{font-size:11px;letter-spacing:.12em;color:#c4b5fd;font-weight:700}
.pp-dailymeta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}.pp-dailymeta span{padding:4px 10px;border-radius:999px;background:rgba(255,255,255,.06);font-size:12px;color:#d8d6ea}
.pp-join{width:100%;padding:13px;border-radius:999px;border:none;background:linear-gradient(90deg,#9333ea,#ec4899);color:#fff;font-weight:800;font-size:15px;font-family:inherit;cursor:pointer;box-shadow:0 8px 24px rgba(236,72,153,.35)}
.pp-join em{font-style:normal;font-size:12px;opacity:.85;margin-left:6px}
.pp-dailyring{position:absolute;right:-30px;top:-30px;width:130px;height:130px;pointer-events:none}
.pp-dailyring i{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(236,72,153,.45);animation:ppDailyRing 3.6s ease-out infinite}
.pp-dailyring i:nth-child(2){animation-delay:1.2s}.pp-dailyring i:nth-child(3){animation-delay:2.4s}
@keyframes ppDailyRing{0%{transform:scale(.3);opacity:.9}100%{transform:scale(1.4);opacity:0}}
.pp-winner{display:flex;gap:12px;align-items:center;padding:10px;border-radius:24px;background:#12121c;border:1px solid rgba(250,204,21,.4);margin-bottom:12px}
.pp-winner img{width:88px;height:88px;border-radius:18px;object-fit:cover;display:block;box-shadow:0 0 0 2px rgba(250,204,21,.6)}
.pp-winner div{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;align-items:flex-start}
.pp-winner small{color:#fde68a;font-weight:700;font-size:12px}.pp-winner p{margin:0;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.pp-seg{display:flex;gap:4px;padding:4px;border-radius:999px;background:#12121c;border:1px solid var(--line);margin:4px 0 12px}
.pp-seg button{flex:1;padding:9px;border:none;border-radius:999px;background:none;color:var(--mut);font-weight:700;font-family:inherit;font-size:13px;cursor:pointer}
.pp-seg button.on{background:linear-gradient(90deg,rgba(147,51,234,.5),rgba(236,72,153,.4));color:#fff}
.pp-card a{position:relative;display:block}.pp-rank{position:absolute;top:8px;left:8px;z-index:2;padding:3px 9px;border-radius:999px;background:rgba(7,7,10,.75);font-size:12px;font-weight:800}
.pp-streak{display:flex;align-items:center;gap:10px;padding:12px 14px;border-radius:20px;background:#12121c;border:1px solid rgba(236,72,153,.3);margin:10px 0}
.pp-streak b{font-size:20px}.pp-streak span{flex:1;font-size:12px;color:#cfcde0}
.pp-stage.pp-is-empty{aspect-ratio:auto!important;height:118px}
.pp-stage.pp-is-empty:not([class*="pp-fmt-"]){height:46px}
.pp-stage.pp-is-empty .pp-empty{padding:10px 16px;display:flex;align-items:center;gap:14px;text-align:left}
.pp-stage.pp-is-empty .pp-empty p{margin:0}
.pp-stage.pp-is-empty .pp-ripple{width:58px;height:58px;flex:0 0 58px;position:relative}
.pp-stage.pp-is-empty.pp-fmt-wallpaper,.pp-stage.pp-is-empty.pp-fmt-story,.pp-stage.pp-is-empty.pp-fmt-poster{height:210px;max-width:128px;border-width:6px;border-radius:26px}
.pp-stage.pp-is-empty.pp-fmt-wallpaper .pp-empty,.pp-stage.pp-is-empty.pp-fmt-story .pp-empty,.pp-stage.pp-is-empty.pp-fmt-poster .pp-empty{display:none}
.pp-stage.pp-is-empty.pp-fmt-wallpaper::before{width:36px;height:10px;top:6px}
.pp-stage.pp-is-empty .pp-lock{top:22px}.pp-stage.pp-is-empty .pp-lock b{font-size:26px}.pp-stage.pp-is-empty .pp-lock small{font-size:9px}
.pp-stage.pp-is-empty.pp-fmt-avatar{height:150px;max-width:150px}
.pp-stage.pp-is-empty.pp-fmt-avatar .pp-empty p,.pp-stage.pp-is-empty.pp-fmt-sticker .pp-empty p{display:none}
.pp-start{margin-top:12px!important}
.pp-legal{margin-top:auto;display:flex;gap:14px;flex-wrap:wrap;font-size:12px}
.pp-legal a{color:var(--mut)}
.pp-foot{display:flex;flex-wrap:wrap;justify-content:center;gap:6px 16px;padding:18px 16px 190px;font-size:12px}
.pp-foot a{color:var(--mut);text-decoration:none}
.pp-card .ia-row{max-width:none}
.pp-toast{bottom:170px}
.pp-stage:has(img){background:#0b0b12}
@keyframes ppRipple{0%{transform:scale(.4);opacity:.9}100%{transform:scale(2.2);opacity:0}}
@keyframes ppRing{0%{transform:scale(1);opacity:.8}100%{transform:scale(1.7);opacity:0}}
@keyframes ppGlow{50%{box-shadow:0 0 0 1px rgba(236,72,153,.7),0 0 60px rgba(236,72,153,.35)}}
@keyframes ppBreathe{50%{box-shadow:0 6px 30px rgba(168,85,247,.6)}}
@keyframes ppReveal{from{opacity:0;filter:blur(14px);transform:scale(1.03)}to{opacity:1;filter:none;transform:none}}
@keyframes ppUp{from{transform:translateY(100%)}to{transform:none}}
@keyframes ppFade{from{opacity:0}}
@keyframes ppPop{from{opacity:0;transform:translate(-50%,16px) scale(.9)}}
@media (min-width:640px){.pp-grid{grid-template-columns:1fr 1fr}}
@media (min-width:1000px){
 .pp-root{padding:24px 28px 40px}
 .pp-layout{display:grid;grid-template-columns:1fr 380px;gap:28px;align-items:start}
 .pp-dock{position:sticky;top:20px;grid-column:2;grid-row:1;padding:0;background:none}
 .pp-bar{border-radius:30px;padding:14px}
 .pp-chiprow{flex-wrap:wrap;overflow:visible}
 .pp-inputrow{flex-wrap:wrap}
 .pp-field{flex-basis:100%}.pp-inputrow textarea{min-height:110px;padding:12px 14px}
 .pp-go{width:100%;justify-content:center;height:48px}
 .pp-toast{bottom:40px}
 .pp-grid{grid-template-columns:repeat(3,1fr)}
}
@media (prefers-reduced-motion:reduce){.pp-root *{animation:none!important}}
`;
