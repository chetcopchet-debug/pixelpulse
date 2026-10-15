'use client';
import { useState } from 'react';

export default function CardActions({ id, prompt, style, ratio, tier, url }) {
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const qs = new URLSearchParams({ vibe: id, ...(style ? { style } : {}), ...(ratio ? { ratio } : {}), ...(tier ? { tier } : {}) });
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); flash(msg); } catch { window.prompt('Copy:', text); }
  };
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'PixelPulse', text: prompt.slice(0, 100), url }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    copy(url, 'Link copied');
  };
  return (
    <>
      <div className="pc-actions">
        <a className="pc-btn pc-go" href={`/?${qs}`}>✦ Pulse this vibe</a>
        <a className="pc-btn" href={`/?${new URLSearchParams({ repaint: id, src: url })}`}>◐ Repaint</a>
        <button className="pc-btn" onClick={() => copy(prompt, 'Prompt copied')}>✎ Copy prompt</button>
        <button className="pc-btn" onClick={share}>↗ Share</button>
      </div>
      {toast && <div className="pc-toast">{toast}</div>}
    </>
  );
}
