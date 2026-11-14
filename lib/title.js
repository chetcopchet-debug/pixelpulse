// A short name for a creation, taken from its prompt: "Elderly fisherman", "Red fox", "Storm lighthouse".
// A structured prompt names its subject on the "Subjects:" line; a plain one starts with it. The name is the
// first few words of that, without the article and without what follows the first "with", "in", comma...
// It is made on the page, from the words already there: nothing is saved and no model is asked.
const STOP = /\s*(?:[,.;:(]|\s(?:with|in|on|at|of about|wearing|who|that|facing|under|over|inside|beside|behind|from|standing|sitting|holding|against|surrounded)\s)/i;

export function shortTitle(prompt, { words = 6, chars = 40 } = {}) {
  const text = String(prompt || '').trim();
  if (!text) return '';
  const subj = /(?:^|\n)\s*Subjects?:\s*([^\n]+)/i.exec(text);
  const scene = /(?:^|\n)\s*Scene:\s*([^\n]+)/i.exec(text);
  let line = (subj ? subj[1] : scene ? scene[1] : text.split('\n')[0]).trim();
  line = line.replace(/^(?:an?|the|some|two|three)\s+/i, '');
  const cut = line.search(STOP);
  if (cut > 3) line = line.slice(0, cut);
  line = line.split(/\s+/).slice(0, words).join(' ');
  if (line.length > chars) line = line.slice(0, chars).replace(/\s+\S*$/, '');
  line = line.replace(/[\s,.;:!?"'“”-]+$/, '');
  return line ? line.charAt(0).toUpperCase() + line.slice(1) : '';
}
