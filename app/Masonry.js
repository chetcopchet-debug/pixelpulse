"use client";
import { useEffect, useState } from "react";

// Stable masonry: items keep their reading order and are placed into the currently shortest column,
// using each image's known aspect ratio (so nothing jumps when images load, and appending a page
// never moves cards that are already on screen).
const ratioOf = (r) => { const [a, b] = String(r || "1:1").split(":").map(Number); return a > 0 && b > 0 ? b / a : 1; };

function useColumns(bps) {
  const [n, setN] = useState(bps[0][1]);
  useEffect(() => {
    const qs = bps.map(([w, c]) => [window.matchMedia(`(min-width:${w}px)`), c]);
    const pick = () => setN(qs.reduce((acc, [q, c]) => (q.matches ? c : acc), bps[0][1]));
    pick(); qs.forEach(([q]) => q.addEventListener("change", pick));
    return () => qs.forEach(([q]) => q.removeEventListener("change", pick));
    // eslint-disable-next-line
  }, []);
  return n;
}

export default function Masonry({ items, getRatio, renderItem, className = "", breakpoints = [[0, 2], [900, 3]], bodyWeight = 0.55 }) {
  const n = useColumns(breakpoints);
  const cols = Array.from({ length: n }, () => ({ h: 0, list: [] }));
  items.forEach((it, i) => {
    let c = cols[0]; for (const x of cols) if (x.h < c.h - 0.01) c = x;
    c.list.push([it, i]); c.h += ratioOf(getRatio(it)) + bodyWeight;
  });
  return (
    <div className={`pp-masonry ${className}`} style={{ gridTemplateColumns: `repeat(${n},minmax(0,1fr))` }}>
      {cols.map((c, ci) => <div className="pp-mcol" key={ci}>{c.list.map(([it, i]) => renderItem(it, i))}</div>)}
    </div>
  );
}
export const MASONRY_CSS = `
.pp-masonry{display:grid;gap:12px;align-items:start}
.pp-mcol{display:flex;flex-direction:column;gap:12px;min-width:0}
.pp-masonry .pp-card{container-type:inline-size;border-radius:20px}
.pp-masonry .pp-card img{height:auto;object-fit:cover}
@container (max-width:250px){
 .pp-masonry .pp-cardbody{padding:10px}
 .pp-masonry .pp-cardbody p{font-size:12.5px}
 .pp-masonry .pp-meta{display:none}
 .pp-masonry .ia-row{gap:5px}
 .pp-masonry .ia-pill{min-height:40px;padding:0 6px}
 .pp-masonry .ia-accent span{display:none}
 .pp-masonry .ia-more{flex-basis:40px}
}
`;
