'use client';
import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('Cinematic');
  const [loading, setLoading] = useState(false);
  const [credits, setCredits] = useState(5);
  const [resultImage, setResultImage] = useState(null);

  const styles = ['Cinematic', '3D Render', 'Anime', 'Cyberpunk', 'Oil Painting'];

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (credits <= 0) {
      alert('נגמרו לך הקרדיטים!');
      return;
    }

    setLoading(true);
    setResultImage(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, style: selectedStyle }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת התמונה');
      }

      setResultImage(data.imageUrl);
      setCredits(prev => prev - 1);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ backgroundColor: '#09090b', color: 'white', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', fontFamily: 'sans-serif' }}>
      <div style={{ width: '100%', maxWidth: '700px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
        <h1 style={{ fontSize: '1.8rem', background: 'linear-gradient(to right, #a855f7, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
          PixelPulse AI
        </h1>
        <div style={{ backgroundColor: '#18181b', padding: '8px 16px', borderRadius: '20px', border: '1px solid #27272a', fontSize: '0.9rem', color: '#a1a1aa' }}>
          קרדיטים: <span style={{ color: '#ec4899', fontWeight: 'bold' }}>{credits}</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '700px', backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '16px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
        <label style={{ display: 'block', marginBottom: '10px', fontSize: '1rem', color: '#d4d4d8' }}>
          תאר את מה שתרצה ליצור:
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="למשל: חתול אסטרונאוט מרחף בחלל..."
          style={{ width: '100%', height: '100px', backgroundColor: '#09090b', color: 'white', border: '1px solid #3f3f46', borderRadius: '8px', padding: '12px', fontSize: '1rem', resize: 'none', outline: 'none', boxSizing: 'border-box', marginBottom: '20px' }}
        />

        <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.9rem', color: '#a1a1aa' }}>
          בחר סגנון אמנותי:
        </label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
          {styles.map((style) => (
            <button
              key={style}
              onClick={() => setSelectedStyle(style)}
              style={{
                backgroundColor: selectedStyle === style ? '#9333ea' : '#27272a',
                color: 'white',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {style}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          style={{
            width: '100%',
            backgroundColor: loading ? '#52525b' : '#9333ea',
            color: 'white',
            padding: '14px',
            fontSize: '1.1rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'מעבד בקשה בשרת...' : 'התחל לייצר (קרדיט 1-)'}
        </button>

        {resultImage && (
          <div style={{ marginTop: '24px', textAlign: 'center' }}>
            <p style={{ color: '#4ade80', marginBottom: '10px' }}>התמונה נוצרה בהצלחה!</p>
            <img src={resultImage} alt="Generated AI" style={{ width: '100%', borderRadius: '12px', border: '1px solid #3f3f46' }} />
          </div>
        )}
      </div>
    </main>
  );
}
