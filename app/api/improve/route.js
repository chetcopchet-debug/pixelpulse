import { NextResponse } from 'next/server';
import { accountGate } from '../../../lib/needAccount';
import { getCreatorId } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { readAccount } from '../../../lib/account';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { preparePrompt, improveAllowed, IMPROVE_DAILY, IMPROVE_DAILY_PRO } from '../../../lib/translate';
import { checkPromptText, blockedMessage as blocked } from '../../../lib/moderation';
import { setCreditsCookie, getClientIp, freeState, chargeCredits, paidFor } from '../../../lib/credits';
import { hasPro } from '../../../lib/paid';
import { TOOLS } from '../../../lib/replicate';
import { VIDEO_WITH_SOUND } from '../../../lib/videoPricing';

export const maxDuration = 45;
export const dynamic = 'force-dynamic';

const PRO = TOOLS.improvePro;

// POST { prompt, kind: 'image' | 'video', level?: 'pro', model?: <video model id>, avoid?: [earlier versions] }
//   -> { prompt, improved }
// The improve button in the prompt box. Pressed by the person, so it always improves, long prompts too, and every
// press takes a different direction. Two levels:
//   standard: free, a fixed number a day (more with a Yelvo Pro subscription); past that it answers why: 'limit'.
//   pro:      the strongest model that answers; costs one credit, returned when nothing was improved.
export async function POST(request) {
  const stop = accountGate(request); if (stop) return stop; // creating needs an account, and so does this
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const kind = body?.kind === 'video' ? 'video' : 'image';
  const pro = body?.level === 'pro';
  if (!prompt) return NextResponse.json({ error: kind === 'video' ? 'Describe the video first.' : 'Describe the image first.' }, { status: 400 });
  const bad = checkPromptText(prompt);
  if (bad) return NextResponse.json({ error: blocked(bad) }, { status: 400 });
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  // Earlier versions offered for this same idea: the new one must differ from them.
  const avoid = Array.isArray(body?.avoid) ? body.avoid.filter((v) => typeof v === 'string' && v.trim()).slice(-3) : [];
  const press = { avoid, level: pro ? 'pro' : 'std', sound: kind === 'video' && VIDEO_WITH_SOUND.includes(body?.model) };

  if (!pro) {
    const subscriber = admin ? false : await hasPro(creator.id);
    if (!await improveAllowed(creator.id, admin, subscriber)) {
      return NextResponse.json({ prompt, improved: false, why: 'limit', limit: subscriber ? IMPROVE_DAILY_PRO : IMPROVE_DAILY, pro: { cost: PRO.cost } }, { status: 429 });
    }
    const out = await preparePrompt(prompt, { admin, improve: kind, press });
    const badOut = checkPromptText(out.prompt);
    if (badOut) return NextResponse.json({ error: blocked(badOut) }, { status: 400 });
    return NextResponse.json({ prompt: out.prompt, improved: out.improved, ...(out.improved ? {} : { why: 'busy' }) });
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
  const out = await preparePrompt(prompt, { admin, improve: kind, press });
  const badOut = checkPromptText(out.prompt);
  if (badOut || !out.improved) await charge.refund();
  if (badOut) return answer({ error: blocked(badOut) }, 400);
  return answer({ prompt: out.prompt, improved: out.improved, level: 'pro', ...(out.improved ? {} : { why: 'busy' }) });
}
