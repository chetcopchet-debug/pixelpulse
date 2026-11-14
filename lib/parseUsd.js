// What the owner typed, as dollars: "25", "25.5", "25,5", "$25", "25 $", "1,250.40". null when it is not an amount.
export function parseUsd(typed) {
  if (typeof typed === 'number') return Number.isFinite(typed) && typed >= 0 && typed <= 100000 ? typed : null;
  let t = String(typed ?? '').replace(/[\s$\u200e\u200f]|usd|dollars?/gi, '');
  if (t.includes(',') && t.includes('.')) t = t.replace(/,/g, ''); else t = t.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return v <= 100000 ? v : null;
}
