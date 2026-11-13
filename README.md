# pixelpulse

## Languages

The site speaks English, Español, Português (Brasil), Français, Deutsch, Italiano, 日本語, 한국어, 简体中文 and Bahasa Indonesia. It opens in the browser's language (English when that language is not one of ours), and the choice made in Settings or in the footer is remembered.

**Adding text.** Write it in English inside `t("…")`. Values go in braces: `t("{n} credits", { n })`. A list defined outside a component marks its texts with `N("…")` and shows them with `t(item)`. A sentence with a link uses `rich(t("See the <a>Refund Policy</a>."), { a: (c) => <a href="…">{c}</a> })`. A message the server sends is listed in `app/i18n/serverMessages.js`.

**Translating it.** `node scripts/i18n.mjs` lists what each language is missing. Add the line to each `app/i18n/<language>.js` (English on the left, the translation on the right). The tests fail until every language has every text with the same `{values}`.

**Adding a language.** Add it to `LANGS` in `app/i18n/core.js`, create `app/i18n/<id>.js`, and add it to the lists in `app/i18n/index.js`, `app/i18n/server.js`, `scripts/i18n.mjs`, `scripts/email.mjs` and `app/layout.js`.

**The sign-in email.** Its words are in `supabase/email/texts.mjs`. `node scripts/email.mjs` writes `supabase/email/sign-in.html` and `sign-in.subject.txt`; paste both into Supabase (Authentication, Emails, Magic link). The email is sent in the language the person used on the site.

Not translated: the Terms, Privacy and other policy texts (a line in the visitor's language says the English version applies), model names, the `/formats` pages and `/admin`.
