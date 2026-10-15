'use client';
import { useState } from 'react';
import { thumbUrl, ratioWH } from '../lib/thumbs';

// Small image for grids: tries the ~400px thumbnail, falls back to the full image if it isn't there yet.
export default function Thumb({ src, ratio, alt = '', eager, ...rest }) {
  const t = thumbUrl(src);
  const [cur, setCur] = useState(t);
  const wh = ratioWH(ratio);
  return (
    <img src={cur} alt={alt} width={wh.width} height={wh.height} loading={eager ? 'eager' : 'lazy'} decoding="async"
      onError={() => { if (cur !== src) setCur(src); }} {...rest} />
  );
}
