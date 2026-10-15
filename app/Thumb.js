'use client';
import { useEffect, useState } from 'react';
import { thumbUrl, ratioWH } from '../lib/thumbs';

// Grid image: ~400px thumbnail -> full image -> placeholder tile. Never shows a broken icon or alt text.
export default function Thumb({ src, ratio, alt = '', eager, onFail, className, style, ...rest }) {
  const t = thumbUrl(src);
  const [stage, setStage] = useState(0); // 0 thumb, 1 full, 2 failed
  useEffect(() => { setStage(0); }, [src]);
  const wh = ratioWH(ratio);
  if (!src || stage === 2) {
    return <span className={`pp-thumbfail${className ? ` ${className}` : ''}`} style={style} role="img" aria-label={alt ? `Image unavailable: ${alt}` : 'Image unavailable'}>◌</span>;
  }
  if (/\.mp4(\?|$)/i.test(src)) {
    return <video src={src} muted loop playsInline autoPlay preload="metadata" width={wh.width} height={wh.height} className={className}
      style={{ objectFit: 'cover', display: 'block', width: '100%', ...style }} aria-label={alt || 'Video'} onError={() => setStage(2)} />;
  }
  const cur = stage === 0 ? t : src;
  return (
    <img key={cur} src={cur} alt={alt} width={wh.width} height={wh.height} loading={eager ? 'eager' : 'lazy'} decoding="async"
      className={className} style={{ color: 'transparent', ...style }}
      onError={() => { if (stage === 0 && t !== src) setStage(1); else { setStage(2); onFail?.(src); } }} {...rest} />
  );
}
export const THUMB_CSS = '.pp-thumbfail{display:grid;place-items:center;width:100%;height:100%;min-height:60px;aspect-ratio:1;background:radial-gradient(circle at 50% 40%,rgba(147,51,234,.25),transparent 60%),#12121c;color:#6b6b88;font-size:22px}';
