"use client";
// The improve button inside the window of an editing tool (Edit, Keep the face, Edit an area).
// The language model looks at the picture being edited and writes the prompt that tool needs; with nothing
// written, or something general, it proposes a change that suits the picture, a different one on every press.
// Two levels, as in the prompt box: the standard one (free, a number a day) and Pro (one credit).
import { t } from "../i18n/index.js";
import { useEffect, useState } from "react";
import Icon from "./icons";
import { Price } from "./bits";

// edit: "edit" | "face" | "area". image: the id of the picture. more(): extra fields for the request (the area's box).
export default function ImproveBar({ s, text, setText, edit, image, more, disabled }) {
  const [pol, setPol] = useState(null); // { original, last, seen, pro }: what this window was offered so far
  useEffect(() => { if (!text.trim()) setPol(null); }, [text]);
  const busy = Boolean(s.improving);
  const run = async (level) => {
    const out = await s.improveText({ text, polish: pol, level, extra: { edit, image, ...(more ? more() : {}) }, allowEmpty: true, inSheet: true });
    if (out) { setPol(out.polish); setText(out.prompt); }
  };
  if (busy) return <div className="polish" role="status" style={{ margin: 0 }}><i className="spin" style={{ width: 16, height: 16, flex: "none" }} /><span className="grow">{t("Improving your prompt…")}</span></div>;
  return (
    <div className="polish" role="group" aria-label={t("Improve this prompt now")} style={{ margin: 0, flexWrap: "wrap" }}>
      <button disabled={disabled} onClick={() => run()}><Icon name="wand" size={16} />{pol ? t("Another version") : t("Improve")}</button>
      <button className="propill" disabled={disabled} onClick={() => run("pro")} aria-label={t("Improve with Pro, 1 credit")}><Icon name="wand" size={14} />{t("Pro")}<Price n={1} /></button>
      {pol ? <button onClick={() => { setText(pol.original); setPol(null); }}><Icon name="undo" size={16} />{t("Undo")}</button> : null}
      <span className="grow" style={{ flexBasis: "100%" }}>{pol ? (pol.pro ? t("Improved with Pro. You can edit it.") : t("Improved. You can edit it.")) : t("It looks at your image and writes the prompt for you.")}</span>
    </div>
  );
}
