"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Initializing AI...");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(5);
  const [history, setHistory] = useState([]);

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

  useEffect(() => {
    try {
      const savedCredits = localStorage.getItem("pp_credits");
      if (savedCredits !== null) setCredits(parseInt(savedCredits, 10));

      const savedHistory = localStorage.getItem("pp_history");
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    } catch (e) {
      console.error(e);
    }
  }, []);

  const handleSurpriseMe = () => {
    const random = surprisePrompts[Math.floor(Math.random() * surprisePrompts.length)];
    setPrompt(random);
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
      setTimeout(() => setLoadingText("Translating & optimizing prompt..."), 2000),
      setTimeout(() => setLoadingText("Connecting to Flux AI neural network..."), 6000),
      setTimeout(() => setLoadingText("Rendering pixels and lighting..."), 12000),
      setTimeout(() => setLoadingText("Finalizing masterpiece, almost ready..."), 25000),
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
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      const updatedHistory = [newItem, ...history].slice(0, 12);
      setHistory(updatedHistory);
      localStorage.setItem("pp_history", JSON.stringify(updatedHistory));
    } catch (err) {
      setError(err.message);
    } finally {
      textIntervals.forEach(clearTimeout);
      setLoading(false);
      setLoadingText("Initializing AI...");
    }
  };

  // מנגנון הורדה שעוקף חסימות CORS באמצעות נתיב צד שלישי מאובטח (CORS proxy / fetch blob)
  const handleDownload = async (imgUrl) => {
    try {
      setDownloading(true);
      // שימוש בפרוקסי פתוח להורדת קבצים שמונע פתיחת כרטיסייה
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
      // גיבוי למקרה קיצוני
      const link = document.createElement("a");
      link.href = imgUrl;
      link.target = "_blank";
      link.download = "pixelpulse.webp";
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      dir="ltr"
      style={{
        minHeight: "100vh",
        backgroundColor: "#0a0a0f",
        color: "#ffffff",
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: "24px 16px 60px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: "520px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #222230",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "24px" }}>✨</span>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: "800",
              margin: 0,
              background: "linear-gradient(90deg, #a855f7, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            PixelPulse AI
          </h1>
        </div>
        <div
          style={{
            backgroundColor: "#181824",
            border: "1px solid #2e2e42",
            padding: "6px 14px",
            borderRadius: "20px",
            fontSize: "14px",
            fontWeight: "600",
            color: "#c084fc",
          }}
        >
          ⚡ Credits: {credits}
        </div>
      </header>

      <main
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#12121a",
          border: "1px solid #222230",
          borderRadius: "20px",
          padding: "22px",
          boxSizing: "border-box",
          boxShadow: "0 12px 35px rgba(0,0,0,0.6)",
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
          <label style={{ color: "#d1d1e0", fontSize: "15px", fontWeight: "600" }}>
            Describe your vision:
          </label>
          <button
            onClick={handleSurpriseMe}
            style={{
              backgroundColor: "#1e1e2d",
              border: "1px solid #34344e",
              color: "#c084fc",
              padding: "5px 12px",
              borderRadius: "8px",
              fontSize: "12px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            🎲 Surprise Me
          </button>
        </div>

        <textarea
          rows="4"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe what you want to create in detail..."
          style={{
            width: "100%",
            backgroundColor: "#08080c",
            border: "1px solid #2a2a3c",
            borderRadius: "12px",
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

        <label style={{ display: "block", color: "#d1d1e0", fontSize: "15px", marginBottom: "10px", fontWeight: "600" }}>
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
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: isSelected ? "1px solid #a855f7" : "1px solid #252538",
                  backgroundColor: isSelected ? "rgba(147, 51, 234, 0.25)" : "#181824",
                  color: isSelected ? "#ffffff" : "#a0a0b8",
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

        <label style={{ display: "block", color: "#d1d1e0", fontSize: "15px", marginBottom: "10px", fontWeight: "600" }}>
          Choose Art Style:
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "24px" }}>
          {stylesList.map((s) => {
            const isSelected = style === s;
            return (
              <button
                key={s}
                onClick={() => setStyle(s)}
                style={{
                  padding: "9px 14px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "none",
                  backgroundColor: isSelected ? "#9333ea" : "#1e1e2a",
                  color: isSelected ? "#ffffff" : "#c4c4d4",
                  boxShadow: isSelected ? "0 4px 12px rgba(147, 51, 234, 0.4)" : "none",
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
            fontSize: "17px",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 6px 20px rgba(147, 51, 234, 0.35)",
          }}
        >
          {loading ? `✨ ${loadingText}` : "Generate Image (1 Credit)"}
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
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        {image && (
          <div style={{ marginTop: "28px", textAlign: "center" }}>
            <p style={{ color: "#34d399", fontWeight: "600", fontSize: "15px", marginBottom: "12px" }}>
              ✨ Masterpiece Ready!
            </p>
            <div
              style={{
                borderRadius: "14px",
                overflow: "hidden",
                border: "1px solid #2e2e42",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                marginBottom: "14px",
              }}
            >
              <img src={image} alt="Generated AI Art" style={{ width: "100%", height: "auto", display: "block" }} />
            </div>

            <button
              onClick={() => handleDownload(image)}
              disabled={downloading}
              style={{
                width: "100%",
                backgroundColor: "#1e1e2d",
                border: "1px solid #3b3b54",
                color: "#ffffff",
                padding: "12px",
                borderRadius: "10px",
                fontSize: "15px",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              {downloading ? "Downloading to device..." : "⬇️ Download High-Res Image"}
            </button>
          </div>
        )}
      </main>

      {history.length > 0 && (
        <section style={{ width: "100%", maxWidth: "520px", marginTop: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "#e2e2f0" }}>
              🖼️ Your Recent Creations
            </h2>
            <button
              onClick={() => {
                setHistory([]);
                localStorage.removeItem("pp_history");
              }}
              style={{ background: "none", border: "none", color: "#7a7a90", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear History
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            {history.map((item, idx) => (
              <div
                key={idx}
                onClick={() => setImage(item.url)}
                style={{
                  backgroundColor: "#12121a",
                  border: "1px solid #222230",
                  borderRadius: "12px",
                  overflow: "hidden",
                  cursor: "pointer",
                }}
              >
                <img src={item.url} alt={item.prompt} style={{ width: "100%", height: "150px", objectFit: "cover", display: "block" }} />
                <div style={{ padding: "8px 10px" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "#b4b4c4", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {item.prompt}
                  </p>
                  <span style={{ fontSize: "10px", color: "#7c7c94" }}>{item.style} • {item.aspectRatio || "1:1"}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
