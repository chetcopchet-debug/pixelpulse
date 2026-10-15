"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
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

  const handleEnhancePrompt = () => {
    if (!prompt.trim()) {
      setPrompt("A stunning cinematic masterpiece, perfect composition, professional lighting, photorealistic details");
      return;
    }

    const currentText = prompt.trim().toLowerCase();
    let enhanced = prompt.trim();

    if (currentText.includes("car") || currentText.includes("vehicle") || currentText.includes("bike")) {
      enhanced = `${prompt.trim()}, dynamic motion shot, glossy metallic reflections, wet asphalt road, automotive commercial lighting, shot on 35mm lens`;
    } else if (currentText.includes("portrait") || currentText.includes("man") || currentText.includes("woman") || currentText.includes("face") || currentText.includes("person")) {
      enhanced = `${prompt.trim()}, professional portrait photography, detailed skin texture, natural soft lighting, shallow depth of field, sharp focus on eyes`;
    } else if (currentText.includes("cyberpunk") || currentText.includes("neon") || currentText.includes("future")) {
      enhanced = `${prompt.trim()}, intricate cyberpunk aesthetics, glowing neon reflections, volumetric fog, moody atmospheric lighting, futuristic details`;
    } else if (currentText.includes("nature") || currentText.includes("forest") || currentText.includes("mountain") || currentText.includes("animal")) {
      enhanced = `${prompt.trim()}, National Geographic wildlife photography, hyper-realistic textures, natural morning sunlight, breathtaking environment details`;
    } else {
      enhanced = `${prompt.trim()}, highly detailed professional art composition, volumetric lighting, rich textures, award-winning visual depth`;
    }

    setPrompt(enhanced);
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }
    if (!isAdmin && credits <= 0) {
      setError("You are out of credits for today. Come back tomorrow!");
      return;
    }

    setLoading(true);
    setError("");
    setImage(null);
    setNotice("");

    const textIntervals = [
      setTimeout(() => setLoadingText("Analyzing prompt context..."), 2000),
      setTimeout(() => setLoadingText("Optimizing neural pathways..."), 6000),
      setTimeout(() => setLoadingText("Rendering lighting and textures..."), 12000),
      setTimeout(() => setLoadingText("Finalizing masterpiece..."), 25000),
    ];

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, aspectRatio, remixOf }),
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
        likes: 0,
        isPublic: false,
        remixOf,
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
      alert("This masterpiece is already published in the Community Feed!");
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
      alert("🚀 Successfully published to Community Feed!");
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
    setRemixOf(item.id || null);
    setActiveTab("create");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div
      dir="ltr"
      style={{
        minHeight: "100vh",
        backgroundColor: "#07070a",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px 16px 80px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <header
        style={{
          width: "100%",
          maxWidth: "540px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          paddingBottom: "16px",
          borderBottom: "1px solid #1a1a26",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, #9333ea, #ec4899)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              boxShadow: "0 0 15px rgba(147, 51, 234, 0.5)",
            }}
          >
            ✨
          </div>
          <div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "800",
                margin: 0,
                background: "linear-gradient(90deg, #a855f7, #ec4899)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.5px",
              }}
            >
              PixelPulse AI
            </h1>
            <span style={{ fontSize: "11px", color: "#6b6b80", fontWeight: "500" }}>PRO STUDIO V3.1</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              backgroundColor: "#12121c",
              border: "1px solid #262638",
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "600",
              color: "#c084fc",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <span>⚡</span>
            <span>{isAdmin ? "∞ Admin" : `${credits} Credits`}</span>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div
        style={{
          width: "100%",
          maxWidth: "540px",
          display: "flex",
          backgroundColor: "#101018",
          border: "1px solid #1f1f2e",
          borderRadius: "14px",
          padding: "4px",
          marginBottom: "20px",
        }}
      >
        <button
          onClick={() => setActiveTab("create")}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: activeTab === "create" ? "#9333ea" : "transparent",
            color: activeTab === "create" ? "#ffffff" : "#8e8e9e",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          ✨ Create Studio
        </button>
        <button
          onClick={() => setActiveTab("community")}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "10px",
            border: "none",
            backgroundColor: activeTab === "community" ? "#9333ea" : "transparent",
            color: activeTab === "community" ? "#ffffff" : "#8e8e9e",
            fontWeight: "700",
            fontSize: "14px",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          🌍 Community Feed ({communityFeed.length})
        </button>
      </div>

      {/* Main Content Area */}
      {activeTab === "create" ? (
        <main
          style={{
            width: "100%",
            maxWidth: "540px",
            backgroundColor: "#101018",
            border: "1px solid #1f1f2e",
            borderRadius: "24px",
            padding: "24px",
            boxSizing: "border-box",
            boxShadow: "0 20px 40px rgba(0,0,0,0.7)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <label style={{ color: "#d1d1e0", fontSize: "14px", fontWeight: "600" }}>
              Describe your vision:
            </label>
            <div style={{ display: "flex", gap: "6px" }}>
              <button
                onClick={handleEnhancePrompt}
                style={{
                  backgroundColor: "rgba(147, 51, 234, 0.15)",
                  border: "1px solid rgba(147, 51, 234, 0.4)",
                  color: "#d8b4fe",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🪄 Smart Enhance
              </button>
              <button
                onClick={handleSurpriseMe}
                style={{
                  backgroundColor: "#191924",
                  border: "1px solid #2e2e42",
                  color: "#a0a0b8",
                  padding: "5px 10px",
                  borderRadius: "8px",
                  fontSize: "11px",
                  fontWeight: "600",
                  cursor: "pointer",
                }}
              >
                🎲 Surprise
              </button>
            </div>
          </div>

          <textarea
            maxLength={500}
            rows="4"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type what you want to create in Hebrew or English..."
            style={{
              width: "100%",
              backgroundColor: "#050508",
              border: "1px solid #222233",
              borderRadius: "14px",
              padding: "14px",
              color: "#ffffff",
              fontSize: "15px",
              boxSizing: "border-box",
              marginBottom: "20px",
              outline: "none",
              resize: "none",
              lineHeight: "1.5",
            }}
          />

          <label style={{ display: "block", color: "#d1d1e0", fontSize: "14px", marginBottom: "10px", fontWeight: "600" }}>
            Aspect Ratio:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "22px" }}>
            {ratiosList.map((r) => {
              const isSelected = aspectRatio === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setAspectRatio(r.id)}
                  style={{
                    padding: "10px 8px",
                    borderRadius: "12px",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: isSelected ? "1px solid #a855f7" : "1px solid #222233",
                    backgroundColor: isSelected ? "rgba(147, 51, 234, 0.25)" : "#151520",
                    color: isSelected ? "#ffffff" : "#8e8e9e",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                  }}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          <label style={{ display: "block", color: "#d1d1e0", fontSize: "14px", marginBottom: "10px", fontWeight: "600" }}>
            Choose Art Style:
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "26px" }}>
            {stylesList.map((s) => {
              const isSelected = style === s;
              return (
                <button
                  key={s}
                  onClick={() => setStyle(s)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "10px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                    border: "none",
                    backgroundColor: isSelected ? "#9333ea" : "#171722",
                    color: isSelected ? "#ffffff" : "#b0b0c4",
                    boxShadow: isSelected ? "0 4px 14px rgba(147, 51, 234, 0.4)" : "none",
                  }}
                >
                  {s}
                </button>
              );
            })}
          </div>

          <button
            onClick={generateImage}
            disabled={loading}
            style={{
              width: "100%",
              background: "linear-gradient(90deg, #9333ea, #ec4899)",
              color: "#ffffff",
              fontWeight: "700",
              fontSize: "16px",
              padding: "16px",
              borderRadius: "14px",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 8px 25px rgba(147, 51, 234, 0.4)",
            }}
          >
            {loading ? `✨ ${loadingText}` : "Generate Masterpiece (1 Credit)"}
          </button>

          {notice && (
            <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "10px", background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.4)", color: "#fde68a", fontSize: "13px" }}>
              {notice}
            </div>
          )}
          {error && (
            <div
              style={{
                marginTop: "16px",
                padding: "12px",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                borderRadius: "10px",
                color: "#f87171",
                textAlign: "center",
                fontSize: "13px",
              }}
            >
              {error}
            </div>
          )}

          {image && (
            <div style={{ marginTop: "28px", textAlign: "center" }}>
              <p style={{ color: "#34d399", fontWeight: "600", fontSize: "14px", marginBottom: "12px" }}>
                ✨ Masterpiece Ready!
              </p>
              <div
                style={{
                  borderRadius: "16px",
                  overflow: "hidden",
                  border: "1px solid #262638",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                  marginBottom: "14px",
                }}
              >
                <img src={image} alt="Generated AI Art" style={{ width: "100%", height: "auto", display: "block" }} />
              </div>

              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => handleDownload(image)}
                  disabled={downloading}
                  style={{
                    flex: 1,
                    backgroundColor: "#1a1a26",
                    border: "1px solid #2d2d42",
                    color: "#ffffff",
                    padding: "12px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {downloading ? "Downloading..." : "⬇️ Download"}
                </button>
                <button
                  onClick={() => handlePublishToCommunity(currentItem)}
                  style={{
                    flex: 1,
                    backgroundColor: "rgba(147, 51, 234, 0.25)",
                    border: "1px solid rgba(147, 51, 234, 0.5)",
                    color: "#d8b4fe",
                    padding: "12px",
                    borderRadius: "12px",
                    fontSize: "13px",
                    fontWeight: "600",
                    cursor: "pointer",
                  }}
                >
                  {currentItem?.isPublic ? "✅ Published" : "🌍 Publish to Feed"}
                </button>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Community Feed View */
        <div style={{ width: "100%", maxWidth: "540px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "16px", color: "#e2e2f0" }}>
            🌍 Global Community Feed
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
            {communityFeed.length === 0 && !feedLoading && (
              <p style={{ color: "#7c7c94", fontSize: "13px", textAlign: "center" }}>
                {storageEnabled ? "No public creations yet. Be the first to publish!" : "The community feed is coming soon."}
              </p>
            )}
            {communityFeed.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  backgroundColor: "#101018",
                  border: "1px solid #1f1f2e",
                  borderRadius: "16px",
                  overflow: "hidden",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                }}
              >
                <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "240px", objectFit: "cover", display: "block" }} />
                <div style={{ padding: "14px" }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: "13px", color: "#e2e2f0", fontWeight: "500" }}>
                    "{item.prompt}"
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "11px", color: "#7c7c94" }}>{item.style}{item.remixOf ? " • Remix" : ""}</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => handleLike(item)}
                      disabled={item.liked}
                      style={{
                        backgroundColor: item.liked ? "rgba(236, 72, 153, 0.25)" : "transparent",
                        border: "1px solid rgba(236, 72, 153, 0.5)",
                        color: "#f9a8d4",
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: item.liked ? "default" : "pointer",
                      }}
                    >
                      {item.liked ? "❤️" : "🤍"} {item.likes}
                    </button>
                    <button
                      onClick={() => handleRemix(item)}
                      style={{
                        backgroundColor: "rgba(147, 51, 234, 0.25)",
                        border: "1px solid rgba(147, 51, 234, 0.5)",
                        color: "#d8b4fe",
                        padding: "6px 14px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      🔄 Remix Style
                    </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {feedCursor && (
            <button
              onClick={() => loadFeed(feedCursor)}
              disabled={feedLoading}
              style={{ marginTop: "16px", width: "100%", padding: "12px", borderRadius: "12px", background: "#101018", border: "1px solid #1f1f2e", color: "#e2e2f0", cursor: "pointer" }}
            >
              {feedLoading ? "Loading..." : "Load more"}
            </button>
          )}
        </div>
      )}

      {/* History Section */}
      {activeTab === "create" && history.length > 0 && (
        <section style={{ width: "100%", maxWidth: "540px", marginTop: "36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, color: "#e2e2f0" }}>
              🖼️ Your Recent Creations
            </h2>
            {!storageEnabled && <button
              onClick={() => {
                setHistory([]);
                localStorage.removeItem("pp_history");
              }}
              style={{ background: "none", border: "none", color: "#6b6b80", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear History
            </button>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {history.map((item, idx) => (
              <div
                key={item.id || idx}
                style={{
                  backgroundColor: "#101018",
                  border: "1px solid #1f1f2e",
                  borderRadius: "14px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justify: "space-between"
                }}
              >
                <div onClick={() => { setImage(item.url); setCurrentItem(item); }} style={{ cursor: "pointer" }}>
                  <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "140px", objectFit: "cover", display: "block" }} />
                </div>
                <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#b4b4c4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button
                      onClick={() => handlePublishToCommunity(item)}
                      style={{
                        backgroundColor: "rgba(52, 211, 153, 0.15)",
                        border: "1px solid rgba(52, 211, 153, 0.4)",
                        color: "#34d399",
                        padding: "3px 6px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      {item.isPublic ? "✅ Public" : "🌍 Publish"}
                    </button>
                    <button
                      onClick={() => handleRemix(item)}
                      style={{
                        backgroundColor: "rgba(147, 51, 234, 0.2)",
                        border: "1px solid rgba(147, 51, 234, 0.4)",
                        color: "#d8b4fe",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: "pointer",
                      }}
                    >
                      🔄 Remix
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
