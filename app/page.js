"use client";
import { useState, useEffect } from "react";
import RepaintEditor, { REPAINT_CSS } from "./RepaintEditor";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [tier, setTier] = useState("fast");
  const TIERS = [
    { id: "fast", label: "Fast", icon: "⚡", cost: 1, desc: "Flux Schnell" },
    { id: "quality", label: "Quality", icon: "💎", cost: 2, desc: "Flux 1.1 Pro" },
    { id: "text", label: "Text", icon: "🔤", cost: 2, desc: "Ideogram v3" },
  ];
  const tierCost = (TIERS.find((t) => t.id === tier) || TIERS[0]).cost;
  const tierLabel = (id) => { if (id === "upload") return "⇪ Upload"; if (id === "guided") return "◎ Guided"; const t = TIERS.find((x) => x.id === (id || "fast")); return t ? `${t.icon} ${t.label}` : ""; };
  const safeTier = (id) => (TIERS.some((t) => t.id === id) ? id : "fast");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Initializing AI studio...");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(5);
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

  const stylesList = [
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
  });

  const loadHistory = async () => {
    try {
      const d = await fetch("/api/history").then((r) => r.json());
      if (d.enabled === false) {
        setStorageEnabled(false);
        const saved = localStorage.getItem("pp_history");
        if (saved) setHistory(JSON.parse(saved));
        return;
      }
      setStorageEnabled(true);
      // Keep images whose cloud save failed (stored only in this browser)
      let local = [];
      try { local = (JSON.parse(localStorage.getItem("pp_history") || "[]") || []).filter((h) => h && !h.id); } catch {}
      if (Array.isArray(d.items)) setHistory([...local, ...d.items.map(toItem)].slice(0, 36));
      else if (local.length) setHistory(local);
    } catch (e) {
      console.error(e);
    }
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
      })
      .catch(() => {});
    const params = new URLSearchParams(window.location.search);
    if (params.get("vibe")) {
      const st = params.get("style"), ra = params.get("ratio"), ti = params.get("tier");
      if (st && stylesList.includes(st)) setStyle(st);
      if (ra && ratiosList.some((r) => r.id === ra)) setAspectRatio(ra);
      if (ti && TIERS.some((t) => t.id === ti)) setTier(ti);
      window.__ppVibe = true;
      ["vibe", "style", "ratio", "tier"].forEach((k) => params.delete(k));
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
    const adminKey = params.get("admin");
    if (adminKey) {
      params.delete("admin");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash);
      fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: adminKey }) })
        .then((r) => { if (!r.ok) setNotice("Admin key rejected."); })
        .catch(() => {})
        .finally(loadCredits);
    } else {
      loadCredits();
    }
    loadHistory();
    loadFeed();
  }, []);

  useEffect(() => {
    if (activeTab === "community") loadFeed();
  }, [activeTab]);

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
    } catch {}
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!prefsLoaded) return;
    try { localStorage.setItem("pp_prefs", JSON.stringify({ tier, style, aspectRatio })); } catch {}
  }, [tier, style, aspectRatio, prefsLoaded]);

  const VARIATION_TWISTS = ["alternate composition", "different camera angle", "shifted color palette", "new lighting mood", "closer framing", "wider framing"];
  const handleAgain = (item) => {
    if (!item) return;
    setActiveTab("create");
    generateImage({ guide: null, prompt: item.prompt, style: item.style || "Cinematic", aspectRatio: item.aspectRatio || "1:1", tier: safeTier(item.tier), remixOf: item.remixOf || null });
  };
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
  const handleStealVibe = (item) => {
    if (item.style && stylesList.includes(item.style)) setStyle(item.style);
    if (item.aspectRatio && ratiosList.some((r) => r.id === item.aspectRatio)) setAspectRatio(item.aspectRatio);
    if (item.tier && TIERS.some((t) => t.id === item.tier)) setTier(item.tier);
    const short = (item.prompt || "").slice(0, 28) + ((item.prompt || "").length > 28 ? "…" : "");
    showToast(`Vibe loaded from “${short}”`);
  };

  const [repaintItem, setRepaintItem] = useState(null);
  const handleRepaintDone = (d, ok) => {
    if (d.admin) setIsAdmin(true); else if (typeof d.credits === "number") setCredits(d.credits);
    if (!ok) return;
    const ni = toItem(d.item);
    setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
    setRepaintItem(null); setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
    window.scrollTo({ top: 0, behavior: "smooth" }); showToast("◐ Repainted");
  };
  const openRepaint = (item) => { if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; } setRepaintItem(item); };
  const [guide, setGuide] = useState(null); // { id, url }
  const [guideFollow, setGuideFollow] = useState(55);
  const [uploading, setUploading] = useState(false);
  const GUIDED_COST = 2;
  const useAsGuide = (item) => {
    if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; }
    setGuide({ id: item.id, url: item.url }); setActiveTab("create");
    showToast("◎ Guide attached — describe the new image");
    setTimeout(() => document.getElementById("pp-prompt")?.focus(), 50);
  };
  const handleUploadFile = async (file) => {
    if (!file) return;
    if (!/^image\//.test(file.type || "")) { setError("Please choose an image file."); return; }
    if (file.size > 40 * 1024 * 1024) { setError("That image is too large."); return; }
    setUploading(true); setError("");
    try {
      const src = URL.createObjectURL(file);
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Couldn't read that image.")); i.src = src; });
      const scale = Math.min(1, 1536 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      const png = file.type === "image/png";
      if (!png) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); }
      ctx.drawImage(img, 0, 0, w, h); URL.revokeObjectURL(src);
      let data = c.toDataURL(png ? "image/png" : "image/jpeg", 0.88);
      if (data.length > 3.6e6) data = c.toDataURL("image/jpeg", 0.85);
      const r = w / h; const ratio = r > 1.3 ? "16:9" : r < 0.77 ? "9:16" : "1:1";
      const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, ratio }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok || !d.item) throw new Error(d.error || "Upload failed.");
      const ni = toItem(d.item);
      setHistory((prev) => [ni, ...prev].slice(0, 36));
      setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
      showToast("⇪ Uploaded — Repaint, Sharpen, Cutout or use as guide");
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
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
  const handleTool = async (tool, item) => {
    if (!item?.id) { showToast("This image wasn't saved to the cloud"); return; }
    if (toolBusy) return;
    if (tool === "sharpen" && !isAdmin && credits < 1) { setError("Sharpen costs 1 credit — you're out for today."); return; }
    setToolBusy(`${tool}:${item.id}`); setError("");
    showToast(tool === "sharpen" ? "◇ Sharpening… (2x)" : "✂ Cutting out…");
    try {
      const res = await fetch(`/api/${tool}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id }) });
      const d = await res.json();
      if (d.admin) setIsAdmin(true); else if (typeof d.credits === "number") setCredits(d.credits);
      if (!res.ok || !d.item) throw new Error(d.error || "Failed.");
      const ni = toItem(d.item);
      setHistory((prev) => [ni, ...prev.filter((h) => h.id !== ni.id)].slice(0, 36));
      setActiveTab("create"); setImage(ni.url); setCurrentItem(ni);
      window.scrollTo({ top: 0, behavior: "smooth" });
      showToast(tool === "sharpen" ? "◇ Sharpened 2x" : "✂ Background removed");
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
    const tierCost = useGuide ? GUIDED_COST : (TIERS.find((t) => t.id === tier) || TIERS[0]).cost;
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }
    if (!isAdmin && credits < tierCost) {
      setError(credits <= 0 ? "You are out of credits for today. Come back tomorrow!" : `Not enough credits for this model (costs ${tierCost}). Try Fast.`);
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
        body: JSON.stringify({ prompt, style, aspectRatio, remixOf, tier, ...(useGuide ? { guideId: useGuide.id, guideFollow: guideFollow / 100 } : {}) }),
      });

      const data = await res.json();
      if (data.admin) setIsAdmin(true);
      else if (typeof data.credits === "number") setCredits(data.credits);

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
        persistError: data.stored ? null : (data.persistError || "unknown error"),
      };
      setCurrentItem(newItem);
      setRemixOf(null);
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

  const handleDownload = async (imgUrl) => {
    try {
      setDownloading(true);
      const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(imgUrl.replace('https://', ''))}&output=webp`;
      const response = await fetch(proxyUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `pixelpulse-${Date.now()}.webp`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      const link = document.createElement("a");
      link.href = imgUrl;
      link.target = "_blank";
      link.download = "pixelpulse.webp";
      link.click();
    } finally {
      setDownloading(false);
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
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Could not publish.");
      const mark = (x) => (x.id === item.id ? { ...x, isPublic: true } : x);
      setHistory((prev) => prev.map(mark));
      setCurrentItem((c) => (c && c.id === item.id ? { ...c, isPublic: true } : c));
      loadFeed();
      showToast("🚀 Published to the Community Feed");
    } catch (e) {
      alert(e.message);
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

  const handleRemix = (item) => {
    setPrompt(item.prompt);
    setStyle(item.style || "Cinematic");
    setAspectRatio(item.aspectRatio || "1:1");
    if (item.tier) setTier(item.tier);
    setRemixOf(item.id || null);
    setActiveTab("create");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };


  const curTier = TIERS.find((t) => t.id === tier) || TIERS[0];
  const curRatio = ratiosList.find((r) => r.id === aspectRatio) || ratiosList[0];
  const ratioBox = (id) => ({ "1:1": [16, 16], "9:16": [11, 18], "16:9": [20, 12] }[id] || [16, 16]);

  const Actions = ({ item, compact }) => (
    <div className={`pp-actions${compact ? " pp-compact" : ""}`}>
      {item.tier !== "upload" && <>
      <button className="pp-cap" onClick={() => handleAgain(item)} disabled={loading} title="Again">↻<span>Again</span></button>
      <button className="pp-cap" onClick={() => handleVariation(item)} disabled={loading} title="Variation">≈<span>Variation</span></button>
      <button className="pp-cap" onClick={() => handleUsePrompt(item)} title="Use prompt">✎<span>Use prompt</span></button>
      </>}
      <button className={`pp-cap${item.tier === "upload" ? " pp-vibe" : ""}`} onClick={() => useAsGuide(item)} disabled={!item.id} title="Use as guide">◎<span>Use as guide</span></button>
      <button className="pp-cap" onClick={() => handleDownload(item.url)} disabled={downloading} title="Download">⤓<span>Download</span></button>
      <button className="pp-cap" onClick={() => handleTool("sharpen", item)} disabled={!!toolBusy || !item.id} title="Sharpen 2x (1 credit)">{toolBusy === `sharpen:${item.id}` ? "…" : "◇"}<span>Sharpen</span></button>
      <button className="pp-cap" onClick={() => openRepaint(item)} disabled={!!toolBusy || !item.id} title="Repaint an area (2 credits)">◐<span>Repaint</span></button>
      <button className="pp-cap" onClick={() => handleTool("cutout", item)} disabled={!!toolBusy || !item.id} title="Remove background (free)">{toolBusy === `cutout:${item.id}` ? "…" : "✂"}<span>Cutout</span></button>
      {item.isPublic && <button className="pp-cap" onClick={() => handleShare(item)} title="Share">↗<span>Share</span></button>}
      <button className={`pp-cap${item.isPublic ? " pp-on" : " pp-accent"}`} onClick={() => handlePublishToCommunity(item)} title="Publish">{item.isPublic ? "✓" : "◉"}<span>{item.isPublic ? "Live" : "Publish"}</span></button>
    </div>
  );

  return (
    <div dir="ltr" className="pp-root">
      <style>{CSS + REPAINT_CSS}</style>
      <header className="pp-header">
        <div className="pp-brand">
          <div className={`pp-logo${loading ? " pp-beat" : ""}`}><span /></div>
          <div>
            <h1>PixelPulse</h1>
            <small>feel the pulse · make the pixel</small>
          </div>
        </div>
        <div className="pp-credits">{isAdmin ? "∞ Admin" : `${credits} credits`}</div>
      </header>

      <nav className="pp-tabs">
        <button className={activeTab === "create" ? "on" : ""} onClick={() => setActiveTab("create")}>Studio</button>
        <button className={activeTab === "community" ? "on" : ""} onClick={() => setActiveTab("community")}>Pulse Feed <em>{communityFeed.length}</em></button>
      </nav>

      <div className="pp-layout">
      {activeTab === "create" ? (
        <main className="pp-main">
          <section className={`pp-stage${loading ? " pp-generating" : ""}`} style={{ aspectRatio: image ? "auto" : aspectRatio.replace(":", " / ") }}>
            {loading ? (
              <div className="pp-ripple"><i /><i /><i /><b>{loadingText}</b></div>
            ) : image ? (
              <img src={image} alt="Generated AI Art" />
            ) : (
              <div className="pp-empty"><div className="pp-ripple pp-idle"><i /><i /></div><p>Describe it in the Pulse Bar and hit <b>Pulse</b>.</p></div>
            )}
          </section>
          {image && currentItem && !loading && <Actions item={currentItem} />}
          {notice && <div className="pp-notice">{notice}</div>}
          {error && <div className="pp-error">{error}</div>}

          {history.length > 0 && (
            <section className="pp-section">
              <div className="pp-sechead"><h2>Your creations</h2>
                {!storageEnabled && <button className="pp-link" onClick={() => { setHistory([]); localStorage.removeItem("pp_history"); }}>Clear</button>}
              </div>
              <div className="pp-grid">
                {history.map((item, idx) => (
                  <div className="pp-card" key={item.id || idx}>
                    <img src={item.url} alt={item.prompt} onClick={() => { setImage(item.url); setCurrentItem(item); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
                    <div className="pp-cardbody">
                      <p>{item.prompt}</p>
                      <span className="pp-meta">{[tierLabel(item.tier), item.style, item.aspectRatio].filter(Boolean).join(" · ")}</span>
                      <Actions item={item} compact />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>
      ) : (
        <main className="pp-main">
          <div className="pp-sechead"><h2>Pulse Feed</h2></div>
          {communityFeed.length === 0 && !feedLoading && <p className="pp-muted">{storageEnabled ? "No public creations yet. Be the first to publish!" : "The community feed is coming soon."}</p>}
          <div className="pp-grid pp-feed">
            {communityFeed.map((item, idx) => (
              <div className="pp-card" key={item.id || idx}>
                <a href={`/p/${item.id}`}><img src={item.url} alt={item.prompt} /></a>
                <div className="pp-cardbody">
                  <p>“{item.prompt}”</p>
                  <span className="pp-meta">{item.style}{item.tier ? ` · ${tierLabel(item.tier)}` : ""} · {item.aspectRatio || "1:1"}{item.remixOf ? " · Remix" : ""}</span>
                  <div className="pp-actions pp-compact">
                    <button className="pp-cap pp-vibe" onClick={() => handleStealVibe(item)}>✦<span>Steal the Vibe</span></button>
                    <button className={`pp-cap${item.liked ? " pp-liked" : ""}`} onClick={() => handleLike(item)} disabled={item.liked}>{item.liked ? "♥" : "♡"}<span>{item.likes}</span></button>
                    <button className="pp-cap" onClick={() => handleUsePrompt(item)}>✎<span>Use prompt</span></button>
                    <button className="pp-cap" onClick={() => handleVariation(item)} disabled={loading}>≈<span>Variation</span></button>
                    <button className="pp-cap" onClick={() => handleShare({ ...item, isPublic: true })}>↗<span>Share</span></button>
                    <button className="pp-cap" onClick={() => handleTool("sharpen", item)} disabled={!!toolBusy}>◇<span>Sharpen</span></button>
                    <button className="pp-cap" onClick={() => openRepaint(item)} disabled={!!toolBusy}>◐<span>Repaint</span></button>
                    <button className="pp-cap" onClick={() => handleTool("cutout", item)} disabled={!!toolBusy}>✂<span>Cutout</span></button>
                    <button className="pp-cap" onClick={() => handleDownload(item.url)}>⤓<span>Download</span></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {feedCursor && <button className="pp-more" onClick={() => loadFeed(feedCursor)} disabled={feedLoading}>{feedLoading ? "Loading..." : "Load more"}</button>}
        </main>
      )}

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
          {guide && (
            <div className="pp-guide">
              <img src={guide.url} alt="guide" />
              <div className="pp-guidebody">
                <small>◎ Guide · how closely to follow <b>{guideFollow}%</b></small>
                <input type="range" min="0" max="100" value={guideFollow} onChange={(e) => setGuideFollow(+e.target.value)} aria-label="How closely to follow" />
              </div>
              <button className="pp-chip pp-ghost" onClick={() => setGuide(null)} aria-label="Remove guide">✕</button>
            </div>
          )}
          <div className="pp-chiprow">
            <label className={`pp-chip pp-upload${uploading ? " pp-generating" : ""}`} title="Upload a photo">
              {uploading ? "…" : "⇪"} Upload
              <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => { handleUploadFile(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            <button className="pp-chip" onClick={() => setSheetOpen(true)}>{curTier.icon} {curTier.label}</button>
            <button className="pp-chip" onClick={() => setSheetOpen(true)}>{style}</button>
            <button className="pp-chip" onClick={() => setSheetOpen(true)}><i className="pp-ar" style={{ width: ratioBox(aspectRatio)[0], height: ratioBox(aspectRatio)[1] }} />{aspectRatio}</button>
            <span className="pp-spacer" />
            <button className="pp-chip pp-ghost" onClick={handleEnhancePrompt} title="Amplify">🪄 Amplify</button>
            <button className="pp-chip pp-ghost" onClick={handleSurpriseMe} title="Surprise">🎲</button>
          </div>
          <div className="pp-inputrow">
            <button className="pp-tune" onClick={() => setSheetOpen(true)} aria-label="Tune">◐</button>
            <textarea id="pp-prompt" maxLength={500} rows={1} value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && window.innerWidth > 820) { e.preventDefault(); generateImage(); } }}
              placeholder="Describe a vision — any language…" />
            <button className="pp-go" onClick={() => generateImage()} disabled={loading}>
              <span className="pp-go-label">{loading ? "…" : "Pulse"}</span>
              <span className="pp-cost">{isAdmin ? "∞" : `${guide ? GUIDED_COST : curTier.cost}⚡`}</span>
            </button>
          </div>
        </div>
      </div>
      </div>

      {sheetOpen && (
        <div className="pp-scrim" onClick={() => setSheetOpen(false)}>
          <div className="pp-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="pp-grab" />
            <h3>Engine</h3>
            <div className="pp-chips">
              {TIERS.map((t) => (
                <button key={t.id} className={`pp-chip pp-big${tier === t.id ? " on" : ""}`} onClick={() => setTier(t.id)}>
                  <b>{t.icon} {t.label}</b><small>{t.desc} · {t.cost}⚡</small>
                </button>
              ))}
            </div>
            <h3>Style</h3>
            <div className="pp-chips">
              {stylesList.map((s) => <button key={s} className={`pp-chip${style === s ? " on" : ""}`} onClick={() => setStyle(s)}>{s}</button>)}
            </div>
            <h3>Shape</h3>
            <div className="pp-chips">
              {ratiosList.map((r) => (
                <button key={r.id} className={`pp-chip pp-big${aspectRatio === r.id ? " on" : ""}`} onClick={() => setAspectRatio(r.id)}>
                  <i className="pp-ar" style={{ width: ratioBox(r.id)[0] * 1.4, height: ratioBox(r.id)[1] * 1.4 }} /><small>{r.label}</small>
                </button>
              ))}
            </div>
            <button className="pp-done" onClick={() => setSheetOpen(false)}>Done</button>
          </div>
        </div>
      )}

      {repaintItem && <RepaintEditor item={repaintItem} isAdmin={isAdmin} credits={credits} onClose={() => setRepaintItem(null)} onDone={handleRepaintDone} />}
      {toast && <div className="pp-toast" key={toast}>{toast}</div>}
    </div>
  );
}

const CSS = `
:root{--bg:#07070a;--panel:#101018;--line:#1f1f2e;--v:#9333ea;--v2:#a855f7;--p:#ec4899;--txt:#e9e7f5;--mut:#7c7c94}
body{margin:0;background:var(--bg)}
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
.pp-stage img{width:100%;height:auto;display:block;animation:ppReveal .6s ease}
.pp-generating{box-shadow:0 0 0 1px rgba(168,85,247,.6),0 0 40px rgba(168,85,247,.35);animation:ppGlow 1.6s ease-in-out infinite}
.pp-empty{text-align:center;color:var(--mut);font-size:14px;padding:30px}
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
 .pp-inputrow textarea{min-height:110px;flex-basis:calc(100% - 50px);background:#0b0b12;border-radius:20px;padding:12px 14px}
 .pp-go{width:100%;justify-content:center;height:48px}
 .pp-toast{bottom:40px}
 .pp-grid{grid-template-columns:repeat(3,1fr)}
}
@media (prefers-reduced-motion:reduce){.pp-root *{animation:none!important}}
`;
