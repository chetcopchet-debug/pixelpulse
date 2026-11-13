// Builds the sign-in email in every language of the site.
//   node scripts/email.mjs           writes supabase/email/sign-in.html and sign-in.subject.txt
//   node scripts/email.mjs --check   exit 1 when those files are not up to date
// The email itself is sent by Supabase, from a template kept in its dashboard (Authentication, Emails,
// "Magic link"). Paste sign-in.subject.txt into "Subject" and sign-in.html into the message body there.
// The language comes from the person's account: the site saves it as `lang` when the email is requested
// (app/api/auth/start), and the template reads it as .Data.lang. No language saved means English.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { EMAIL_TEXTS } from '../supabase/email/texts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const IDS = ['es', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'zh', 'id'];
const TAGS = { en: 'en', es: 'es', pt: 'pt-BR', fr: 'fr', de: 'de', it: 'it', ja: 'ja', ko: 'ko', zh: 'zh-CN', id: 'id' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function emailTexts() {
  const out = { en: { ...EMAIL_TEXTS.en, button: 'Sign in', label: 'The email has a code' } };
  for (const id of IDS) {
    const dict = (await import(pathToFileURL(join(root, `app/i18n/${id}.js`)).href)).default;
    out[id] = { ...EMAIL_TEXTS[id], button: dict['Sign in'], label: dict['The email has a code'] };
  }
  for (const [id, x] of Object.entries(out)) {
    for (const k of ['title', 'preview', 'lead', 'hint', 'foot', 'button', 'label']) if (!x[k]) throw new Error(`The sign-in email has no "${k}" in ${id}`);
    if (!x.hint.includes('{label}')) throw new Error(`The sign-in email hint in ${id} lost its {label}`);
    x.hint = x.hint.replace('{label}', x.label);
  }
  return out;
}
// One text in every language, as a choice the email service makes when it sends: English unless the account says otherwise.
const pick = (texts, get, html = true) => `${IDS.map((id, i) => `{{ ${i ? 'else ' : ''}if eq $l "${id}" }}${html ? esc(get(texts[id])) : get(texts[id])}`).join('')}{{ else }}${html ? esc(get(texts.en)) : get(texts.en)}{{ end }}`;
const START = '{{ $l := printf "%v" .Data.lang }}';

export async function build() {
  const x = await emailTexts();
  const p = (k) => pick(x, (o) => o[k]);
  const lang = `${IDS.map((id, i) => `{{ ${i ? 'else ' : ''}if eq $l "${id}" }}${TAGS[id]}`).join('')}{{ else }}en{{ end }}`;
  const html = `${START}<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${p('title')}</title>
</head>
<body style="margin:0;padding:0;background-color:#000000;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#000000;">${p('preview')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background-color:#000000;">
<tr><td align="center" style="padding:32px 20px 40px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:440px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

<tr><td style="padding-bottom:36px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;"><img src="https://yelvoai.com/icon-192.png" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>
<td style="vertical-align:middle;padding-left:10px;font-size:20px;line-height:24px;font-weight:700;color:#ffffff;letter-spacing:-0.2px;">Yelvo</td>
</tr></table>
</td></tr>

<tr><td style="font-size:30px;line-height:36px;font-weight:700;color:#ffffff;letter-spacing:-0.6px;padding-bottom:12px;">${p('title')}</td></tr>
<tr><td style="font-size:16px;line-height:24px;color:#a3a3a3;padding-bottom:28px;">${p('lead')}</td></tr>

<tr><td style="padding-bottom:36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:14px;">
<a href="{{ .ConfirmationURL }}" style="display:block;padding:16px 24px;font-size:16px;line-height:24px;font-weight:600;color:#000000;text-decoration:none;">${p('button')}</a>
</td></tr></table>
</td></tr>

<tr><td style="font-size:14px;line-height:20px;color:#a3a3a3;padding-bottom:10px;">${p('hint')}</td></tr>
<tr><td style="padding-bottom:36px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td align="center" bgcolor="#141414" style="background-color:#141414;border:1px solid #2a2a2a;border-radius:14px;padding:18px 4px 18px 12px;font-family:'SF Mono',Menlo,Consolas,'Roboto Mono',monospace;font-size:32px;line-height:40px;font-weight:700;color:#ffffff;letter-spacing:8px;">{{ .Token }}</td>
</tr></table>
</td></tr>

<tr><td style="border-top:1px solid #1f1f1f;padding-top:20px;font-size:13px;line-height:20px;color:#737373;">${p('foot')}</td></tr>

</table>
</td></tr>
</table>
</body>
</html>
`;
  const subject = `${START}${pick(x, (o) => o.title, false)}\n`;
  return { html, subject };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { html, subject } = await build();
  const files = [['supabase/email/sign-in.html', html], ['supabase/email/sign-in.subject.txt', subject]];
  if (process.argv.includes('--check')) {
    const stale = files.filter(([f, s]) => { try { return readFileSync(join(root, f), 'utf8') !== s; } catch { return true; } });
    if (stale.length) { console.log(`Not up to date: ${stale.map(([f]) => f).join(', ')}. Run: node scripts/email.mjs`); process.exit(1); }
    console.log('The sign-in email is up to date.');
  } else { for (const [f, s] of files) writeFileSync(join(root, f), s); console.log('Wrote the sign-in email in 10 languages.'); }
}
