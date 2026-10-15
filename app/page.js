"use client";
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("Cinematic");
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [credits, setCredits] = useState(5);

  const styles = ["Cinematic", "3D Render", "Anime", "Cyberpunk", "Oil Painting"];

  const generateImage = async () => {
    if (!prompt.trim()) {
      setError("Please enter a prompt to generate an image.");
      return;
    }
    if (credits <= 0) {
      setError("You are out of credits! Please upgrade to continue.");
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
    <div dir="ltr" className="min-h-screen bg-[#0d0d12] text-white font-sans flex flex-col items-center p-6">
      {/* Header */}
      <header className="w-full max-w-2xl flex justify-between items-center py-4 border-b border-gray-800 mb-8">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent">
          PixelPulse AI
        </h1>
        <div className="bg-gray-900 border border-gray-700 px-4 py-1.5 rounded-full text-sm font-medium text-purple-300">
          ⚡ Credits: {credits}
        </div>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-xl bg-[#161622] border border-gray-800 rounded-2xl p-6 shadow-2xl">
        <label className="block text-gray-300 text-sm font-semibold mb-2">
          Describe what you want to create:
        </label>
        <textarea
          rows="3"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A cybernetic samurai standing in neon-lit rainy Tokyo..."
          className="w-full bg-[#0d0d12] border border-gray-700 rounded-xl p-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition mb-6 resize-none"
        />

        <label className="block text-gray-300 text-sm font-semibold mb-3">
          Choose Art Style:
        </label>
        <div className="flex flex-wrap gap-2.5 mb-6">
          {styles.map((s) => (
            <button
              key={s}
              onClick={() => setStyle(s)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                style === s
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "bg-[#222233] text-gray-300 hover:bg-[#2c2c40]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          onClick={generateImage}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Generating Masterpiece..." : "Generate Image (1 Credit)"}
        </button>

        {error && (
          <p className="text-red-400 text-sm text-center mt-4 bg-red-950/30 border border-red-800/50 p-3 rounded-lg">
            {error}
          </p>
        )}

        {image && (
          <div className="mt-8 text-center animate-fadeIn">
            <p className="text-emerald-400 font-semibold mb-3">
              ✨ Image Generated Successfully!
            </p>
            <div className="rounded-xl overflow-hidden border border-gray-700 shadow-xl">
              <img src={image} alt="Generated AI Art" className="w-full h-auto object-cover" />
            </div>
            <a
              href={image}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-sm text-purple-400 hover:text-purple-300 underline"
            >
              Open Full Resolution Image ↗
            </a>
          </div>
        )}
      </main>
    </div>
  );
}
