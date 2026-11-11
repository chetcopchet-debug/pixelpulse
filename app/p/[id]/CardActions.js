'use client';
import { useState } from 'react';
import ReportSheet from '../../studio/ReportSheet';

// What a visitor can do with a shared image: start their own from it, share it, copy the prompt, report it.
export default function CardActions({ id, prompt, ratio, tier, format }) {
  const [toast, setToast] = useState('');
  const [reporting, setReporting] = useState(false);
  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const startQs = new URLSearchParams({ vibe: id, p: prompt || '', ...(format && format !== 'free' ? { format } : {}), ...(ratio ? { ratio } : {}), ...(tier ? { tier } : {}) });
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
  return (
    <>
      <a className="btn btn-p btn-wide" style={{ height: 52 }} href={`/?${startQs}`}>Start from this idea</a>
      <div className="r" style={{ gap: 8, marginTop: 8 }}>
        <button className="btn btn-s grow" onClick={share}>Share</button>
        <button className="btn btn-s grow" onClick={() => copy(prompt, 'Prompt copied')}>Copy prompt</button>
      </div>
      <div className="r" style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <a className="link sm r" style={{ minHeight: 44 }} href="/?tab=community">See more on PixelPulse</a>
        <button className="link sm t3" style={{ minHeight: 44 }} onClick={() => setReporting(true)}>Report</button>
      </div>
      {reporting && <ReportSheet id={id} onClose={() => setReporting(false)} onDone={(m) => flash(m)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
