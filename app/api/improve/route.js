import { NextResponse } from 'next/server';
import { refusalLog } from '../../../lib/refusals';
import { accountGate } from '../../../lib/needAccount';
import { getCreatorId } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { readAccount, isTestAccount } from '../../../lib/account';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { preparePrompt, improveAllowed, shortIdea, IMPROVE_DAILY, IMPROVE_DAILY_PRO, EDIT_KINDS } from '../../../lib/translate';
import sharp from 'sharp';
import { getSupabase } from '../../../lib/supabase';
import { isUuid } from '../../../lib/identity';
import { checkPromptText, checkPersonEditText, blockedMessage as blocked } from '../../../lib/moderation';
import { setCreditsCookie, getClientIp, freeState, chargeCredits, paidFor } from '../../../lib/credits';
import { hasPro } from '../../../lib/paid';
import { TOOLS } from '../../../lib/replicate';
import { VIDEO_WITH_SOUND } from '../../../lib/videoPricing';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const PRO = TOOLS.improvePro;

// The picture that is being edited, small, for the language model to look at: 512 px on the long side for the
// standard improvement, 384 for Pro (its model charges by the pixel, and one credit has to cover it).
// Only the person's own picture or a public one. Returns a data URI, or null when it cannot be used.
async function pictureFor(id, creator, side, box = null) {
  const sb = getSupabase();
  if (!sb || !isUuid(id)) return null;
  const { data: row } = await sb.from('images').select('public_url, storage_path, is_public, creator_id, removed_at').eq('id', id).maybeSingle();
  if (!row || row.removed_at || /\.mp4$/i.test(row.storage_path || '')) return null;
  if (!row.is_public && (creator.isNew || row.creator_id !== creator.id)) return null;
  try {
    const res = await fetch(row.public_url, { cache: 'no-store' });
    if (!res.ok) return null;
    let small = await sharp(Buffer.from(await res.arrayBuffer()), { failOn: 'none', limitInputPixels: 120e6 }).rotate()
      .resize(side, side, { fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 80 }).toBuffer();
    // Edit an area: the marked part is shown to the model as a red rectangle drawn on its copy of the picture.
    if (box) {
      const { width: w, height: h } = await sharp(small).metadata();
      const [x0, y0, x1, y1] = box;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${Math.round(x0 * w)}" y="${Math.round(y0 * h)}" width="${Math.max(4, Math.round((x1 - x0) * w))}" height="${Math.max(4, Math.round((y1 - y0) * h))}" fill="none" stroke="#ff0000" stroke-width="3"/></svg>`;
      small = await sharp(small).composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 80 }).toBuffer();
    }
    return `data:image/jpeg;base64,${small.toString('base64')}`;
  } catch (e) { console.error('Improve: the picture could not be read:', e?.message || e); return null; }
}

// POST { prompt, kind: 'image' | 'video', level?: 'pro', model?: <video model id>, avoid?: [earlier versions], auto?: true,
//        edit?: 'edit' | 'area' | 'face' | 'reference' | 'motion', image?: <id of the picture being edited> }
// With `edit` and `image` the model looks at the picture and writes the prompt that kind of editing needs; the
// text may then be empty, and the model proposes a change itself.
//   -> { prompt, improved }
// The improve button in the prompt box. Pressed by the person, so it always improves, long prompts too, and every
// press takes a different direction. Two levels:
//   standard: free, a fixed number a day (more with a Yelvo Pro subscription); past that it answers why: 'limit'.
//   pro:      the strongest model that answers; costs one credit, returned when nothing was improved.
// auto: asked for by the screen just before a creation ("Improve my prompt" is on). Short ideas only, in a neutral
// style: the person's own style if they gave one, otherwise realistic. When today's free ones are used it simply
// answers improved: false, and the creation goes on with the words as written.
async function handlePost(request) {
  const stop = accountGate(request); if (stop) return stop; // creating needs an account, and so does this
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const edit = EDIT_KINDS.includes(body?.edit) && isUuid(body?.image) ? body.edit : null;
  const kind = body?.kind === 'video' || edit === 'motion' ? 'video' : 'image';
  const pro = body?.level === 'pro';
  if (!prompt && !edit) return NextResponse.json({ error: kind === 'video' ? 'Describe the video first.' : 'Describe the image first.' }, { status: 400 });
  const bad = checkPromptText(prompt) || (edit && edit !== 'motion' && edit !== 'area' ? checkPersonEditText(prompt) : null);
  if (bad) return NextResponse.json({ error: blocked(bad) }, { status: 400 });
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  const box = edit === 'area' && Array.isArray(body?.box) && body.box.length === 4 && body.box.every((v) => typeof v === 'number' && v >= 0 && v <= 1) && body.box[2] > body.box[0] && body.box[3] > body.box[1] ? body.box : null;
  const image = edit ? await pictureFor(body.image, creator, pro ? 384 : 512, box) : null;
  if (edit && !image) return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  // What the model wrote for an edit is checked like what a person writes for one.
  const badFor = (text) => checkPromptText(text) || (edit && edit !== 'motion' && edit !== 'area' ? checkPersonEditText(text) : null);
  // Earlier versions offered for this same idea: the new one must differ from them.
  const avoid = Array.isArray(body?.avoid) ? body.avoid.filter((v) => typeof v === 'string' && v.trim()).slice(-3) : [];
  const auto = body?.auto === true && !pro && !edit;
  if (auto && !shortIdea(prompt)) return NextResponse.json({ prompt, improved: false });
  const press = { avoid: auto ? [] : avoid, auto, level: pro ? 'pro' : 'std', sound: kind === 'video' && VIDEO_WITH_SOUND.includes(body?.model), ...(edit ? { edit, boxed: Boolean(box) } : {}) };

  if (!pro) {
    const subscriber = admin ? false : await hasPro(creator.id);
    if (!await improveAllowed(creator.id, admin, subscriber)) {
      console.warn(`Improve: refused, today's ${subscriber ? IMPROVE_DAILY_PRO : IMPROVE_DAILY} free improvements of this account are used`);
      if (auto) return NextResponse.json({ prompt, improved: false, why: 'limit' });
      return NextResponse.json({ prompt, improved: false, why: 'limit', limit: subscriber ? IMPROVE_DAILY_PRO : IMPROVE_DAILY, pro: { cost: PRO.cost } }, { status: 429 });
    }
    const out = await preparePrompt(prompt, { admin: admin || isTestAccount(request), improve: kind, press, image });
    const badOut = badFor(out.prompt);
    if (badOut) return NextResponse.json({ error: blocked(badOut) }, { status: 400 });
    if (!out.improved) console.warn(`Improve: not improved (${out.why || 'busy'})`);
    return NextResponse.json({ prompt: out.prompt, improved: out.improved, ...(out.improved ? {} : { why: out.why || 'busy' }) });
  }

  // Pro: one credit, from the free ones or the bought ones, taken before the model is asked and returned if it
  // gives nothing usable.
  const ip = getClientIp(request);
  const signedIn = Boolean(readAccount(request));
  const state = await freeState({ creator, ip, signedIn });
  const charge = await chargeCredits({ admin, state, ip, creator, cost: PRO.cost, signedIn });
  const wallet = async () => (admin ? { admin: true } : { credits: state.remaining, paid: await paidFor(creator) });
  const answer = async (data, status = 200) => { const res = NextResponse.json({ ...data, ...(await wallet()) }, { status }); if (!admin) setCreditsCookie(res, state); return res; };
  if (!charge.ok) return answer({ error: 'Improve Pro costs 1 credit.', needCredits: { cost: PRO.cost, label: 'Improve Pro' } }, charge.block === 'minute' ? 429 : 402);
  const out = await preparePrompt(prompt, { admin: true, improve: kind, press, image }); // paid for with a credit: not from the free budget
  const badOut = badFor(out.prompt);
  if (!badOut && !out.improved) console.warn('Improve Pro: not improved (busy); the credit was returned');
  if (badOut || !out.improved) await charge.refund();
  if (badOut) return answer({ error: blocked(badOut) }, 400);
  return answer({ prompt: out.prompt, improved: out.improved, level: 'pro', ...(out.improved ? {} : { why: 'busy' }) });
}

// Every refusal is written to the log with its reason (lib/refusals.js).
export const POST = refusalLog('improve', handlePost);
