'use client';
import { useState } from 'react';
import ImageActions, { IA_CSS } from '../../ImageActions';

const CSS_VARS = ':root{--txt:#e9e7f5;--mut:#7c7c94}.pp-grab{width:42px;height:5px;border-radius:9px;background:#33334a;margin:0 auto 6px}.pp-done{width:100%;margin-top:14px;padding:13px;border-radius:999px;border:none;background:#e9e7f5;color:#0b0b12;font-weight:800;font-size:15px}@keyframes ppFade{from{opacity:0}}@keyframes ppUp{from{transform:translateY(100%)}to{transform:none}}';

export default function CardActions({ id, prompt, style, ratio, tier, url }) {
  const [toast, setToast] = useState('');
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2200); };
  const vibeQs = new URLSearchParams({ vibe: id, p: prompt || '', ...(style ? { style } : {}), ...(ratio ? { ratio } : {}), ...(tier ? { tier } : {}) });
  const styleQs = new URLSearchParams({ vibe: 'style', ...(style ? { style } : {}), ...(ratio ? { ratio } : {}), ...(tier ? { tier } : {}) });
  const copy = async (text, msg) => {
    try { await navigator.clipboard.writeText(text); flash(msg); } catch { window.prompt('Copy:', text); }
  };
  const share = async () => {
    const link = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'PixelPulse', text: (prompt || '').slice(0, 100), url: link }); return; } catch (e) { if (e?.name === 'AbortError') return; }
    }
    copy(link, 'Link copied');
  };
  const go = (href) => { window.location.href = href; };
  return (
    <>
      <style>{CSS_VARS + IA_CSS}</style>
      <ImageActions title={prompt}
        primary={[
          { key: 'vibe', icon: '✦', label: 'Pulse this vibe', tone: 'accent', onClick: () => go(`/?${vibeQs}`) },
          { key: 'share', icon: '↗', label: 'Share', onClick: share },
        ]}
        more={[
          { key: 'style', icon: '◈', label: 'Style only', hint: 'Keep your own prompt', onClick: () => go(`/?${styleQs}`) },
          { key: 'copy', icon: '✎', label: 'Copy prompt', onClick: () => copy(prompt, 'Prompt copied') },
          { key: 'repaint', icon: '◐', label: 'Repaint', hint: '2⚡ · paint an area', onClick: () => go(`/?${new URLSearchParams({ repaint: id, src: url })}`) },
          { key: 'feed', icon: '▦', label: 'Explore the feed', onClick: () => go('/?tab=community') },
          { key: 'report', icon: '⚑', label: 'Report', hint: 'Breaks the rules?', tone: 'danger', onClick: async () => {
            const reason = window.prompt('Why are you reporting this image?', ''); if (reason === null) return;
            const r = await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason }) }).catch(() => null);
            flash(r && r.ok ? 'Thanks — we\'ll review it' : 'Couldn\'t send report');
          } },
        ]} />
      {toast && <div className="pc-toast">{toast}</div>}
    </>
  );
}
