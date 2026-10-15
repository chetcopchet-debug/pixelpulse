"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(5);

  const stylesList = ["Cinematic", "3D Render", "Anime", "Cyberpunk", "Oil Painting"];

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

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to generate image.");
      }

      setImage(data.imageUrl);
      setCredits((prev) => prev - 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
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
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <header
        style={{
          width: "100%",
          maxWidth: "480px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
          paddingBottom: "16px",
          borderBottom: "1px solid #222230",
        }}
      >
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

      {/* Main Container */}
      <main
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "#12121a",
          border: "1px solid #222230",
          borderRadius: "18px",
          padding: "20px",
          boxSizing: "border-box",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      >
        <label
          style={{
            display: "block",
            color: "#b4b4c4",
            fontSize: "15px",
            marginBottom: "10px",
            fontWeight: "500",
          }}
        >
          Describe what you want to create:
        </label>

        <textarea
          rows="4"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A majestic lion made of dark smoke and glowing fire embers roaring on a wet cliff..."
          style={{
            width: "100%",
            backgroundColor: "#08080c",
            border: "1px solid #2a2a3c",
            borderRadius: "12px",
            padding: "14px",
            color: "#ffffff",
            fontSize: "16px",
            boxSizing: "border-box",
            marginBottom: "20px",
            outline: "none",
            resize: "none",
            lineHeight: "1.5",
          }}
        />

        <label
          style={{
            display: "block",
            color: "#b4b4c4",
            fontSize: "15px",
            marginBottom: "12px",
            fontWeight: "500",
          }}
        >
          Choose Art Style:
        </label>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "24px",
          }}
        >
          {stylesList.map((s) => {
            const isSelected = style === s;
            return (
              <button
                key={s}
                onClick={() => setStyle(s)}
                style={{
                  padding: "10px 16px",
                  borderRadius: "10px",
                  fontSize: "14px",
                  fontWeight: "600",
                  cursor: "pointer",
                  border: "none",
                  transition: "all 0.2s ease",
                  backgroundColor: isSelected ? "#9333ea" : "#1e1e2a",
                  color: isSelected ? "#ffffff" : "#d1d1e0",
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
            backgroundColor: "#9333ea",
            background: "linear-gradient(90deg, #9333ea, #7e22ce)",
            color: "#ffffff",
            fontWeight: "700",
            fontSize: "17px",
            padding: "16px",
            borderRadius: "12px",
            border: "none",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            boxShadow: "0 4px 20px rgba(147, 51, 234, 0.35)",
          }}
        >
          {loading ? "Generating Masterpiece..." : "Generate Image (1 Credit)"}
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
          <div style={{ marginTop: "24px", textAlign: "center" }}>
            <p
              style={{
                color: "#34d399",
                fontWeight: "600",
                fontSize: "16px",
                marginBottom: "14px",
              }}
            >
              ✨ Image Generated Successfully!
            </p>
            <div
              style={{
                borderRadius: "14px",
                overflow: "hidden",
                border: "1px solid #2e2e42",
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
              }}
            >
              <img
                src={image}
                alt="Generated AI Art"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            </div>
            <a
              href={image}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-block",
                marginTop: "14px",
                color: "#c084fc",
                fontSize: "14px",
                textDecoration: "underline",
              }}
            >
              Download / View Full Size ↗
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
