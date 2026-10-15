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
  const [activeTab, setActiveTab] = useState("create"); // "create" או "community"

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

  // ברירת מחדל לקהילה גלובלית
  const initialCommunity = [
    {
      url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=1000&auto=format&fit=crop",
      prompt: "Abstract 3D fluid neon waves glowing in dark space, futuristic digital art",
      style: "3D Render",
      aspectRatio: "1:1",
      author: "Alex_Dev"
    },
    {
      url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=1000&auto=format&fit=crop",
      prompt: "Cyberpunk street in Tokyo at night with neon signs and heavy rain reflections",
      style: "Cyberpunk",
      aspectRatio: "9:16",
      author: "Elena_V"
    },
    {
      url: "https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=1000&auto=format&fit=crop",
      prompt: "Epic fantasy castle on a floating mountain in the clouds at golden sunset",
      style: "Fantasy",
      aspectRatio: "16:9",
      author: "MasterAI"
    }
  ];

  useEffect(() => {
    try {
      const savedCredits = localStorage.getItem("pp_credits");
      if (savedCredits === null || parseInt(savedCredits, 10) <= 0) {
        setCredits(5);
        localStorage.setItem("pp_credits", "5");
      } else {
        setCredits(parseInt(savedCredits, 10));
      }

      const savedHistory = localStorage.getItem("pp_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedCommunity = localStorage.getItem("pp_community");
      if (savedCommunity) {
        setCommunityFeed(JSON.parse(savedCommunity));
      } else {
        setCommunityFeed(initialCommunity);
        localStorage.setItem("pp_community", JSON.stringify(initialCommunity));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

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
    if (credits <= 0) {
      setError("You are out of credits!");
      return;
    }

    setLoading(true);
    setError("");
    setImage(null);

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
        body: JSON.stringify({ prompt, style, aspectRatio }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate image.");
      }

      setImage(data.imageUrl);

      const newCredits = credits - 1;
      setCredits(newCredits);
      localStorage.setItem("pp_credits", newCredits.toString());

      const newItem = {
        url: data.imageUrl,
        prompt: prompt.trim(),
        style,
        aspectRatio,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        author: "You"
      };
      const updatedHistory = [newItem, ...history].slice(0, 12);
      setHistory(updatedHistory);
      localStorage.setItem("pp_history", JSON.stringify(updatedHistory));
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

  // פרסום תמונה לפיד הקהילה הציבורי
  const handlePublishToCommunity = (item) => {
    const exists = communityFeed.some(c => c.url === item.url);
    if (exists) {
      alert("This masterpiece is already published in the Community Feed!");
      return;
    }
    const updatedCommunity = [item, ...communityFeed];
    setCommunityFeed(updatedCommunity);
    localStorage.setItem("pp_community", JSON.stringify(updatedCommunity));
    alert("🚀 Successfully published to Community Feed!");
  };

  const handleRemix = (item) => {
    setPrompt(item.prompt);
    setStyle(item.style || "Cinematic");
    setAspectRatio(item.aspectRatio || "1:1");
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
            <span>{credits} Credits</span>
          </div>
          <button
            onClick={() => {
              setCredits(5);
              localStorage.setItem("pp_credits", "5");
            }}
            title="Reset Credits"
            style={{
              backgroundColor: "#12121c",
              border: "1px solid #262638",
              color: "#8e8e9e",
              padding: "6px 10px",
              borderRadius: "20px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            🔄
          </button>
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
                  onClick={() => handlePublishToCommunity({
                    url: image,
                    prompt: prompt.trim(),
                    style,
                    aspectRatio,
                    author: "You"
                  })}
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
                  🌍 Publish to Feed
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
            {communityFeed.map((item, idx) => (
              <div
                key={idx}
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
                    <span style={{ fontSize: "11px", color: "#7c7c94" }}>By {item.author || "Creator"} • {item.style}</span>
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
            ))}
          </div>
        </div>
      )}

      {/* History Section */}
      {activeTab === "create" && history.length > 0 && (
        <section style={{ width: "100%", maxWidth: "540px", marginTop: "36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "17px", fontWeight: "700", margin: 0, color: "#e2e2f0" }}>
              🖼️ Your Recent Creations
            </h2>
            <button
              onClick={() => {
                setHistory([]);
                localStorage.removeItem("pp_history");
              }}
              style={{ background: "none", border: "none", color: "#6b6b80", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear History
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {history.map((item, idx) => (
              <div
                key={idx}
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
                <div onClick={() => setImage(item.url)} style={{ cursor: "pointer" }}>
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
                      🌍 Publish
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
