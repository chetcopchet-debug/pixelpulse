import { createElement, Fragment } from "react";

// A sentence with a link or bold words inside: "See the <a>Refund policy</a>." The marked part is handed to
// tags.a (or tags.b, ...), so each language can put it where its grammar wants it.
export function rich(str, tags) {
  const out = [];
  const re = /<(\w+)>(.*?)<\/\1>/g;
  let i = 0, m;
  while ((m = re.exec(str))) {
    if (m.index > i) out.push(str.slice(i, m.index));
    out.push(createElement(Fragment, { key: out.length }, tags[m[1]] ? tags[m[1]](m[2]) : m[2]));
    i = m.index + m[0].length;
  }
  if (i < str.length) out.push(str.slice(i));
  return out;
}
