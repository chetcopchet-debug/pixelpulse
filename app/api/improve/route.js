import { NextResponse } from 'next/server';
import { accountGate } from '../../../lib/needAccount';
import { getCreatorId } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { preparePrompt, shortIdea, improveAllowed, IMPROVE_DAILY } from '../../../lib/translate';
import { checkPromptText, blockedMessage as blocked } from '../../../lib/moderation';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// POST { prompt, kind: 'image' | 'video' } -> { prompt, improved }
// The "improve" button in the prompt box: the same filling-in that happens by itself before a generation, shown
// to the person first so they can read it, change it or take it back. Free, with a daily limit per account.
export async function POST(request) {
  const stop = accountGate(request); if (stop) return stop; // creating needs an account, and so does this
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const kind = body?.kind === 'video' ? 'video' : 'image';
  if (!prompt) return NextResponse.json({ error: kind === 'video' ? 'Describe the video first.' : 'Describe the image first.' }, { status: 400 });
  const bad = checkPromptText(prompt);
  if (bad) return NextResponse.json({ error: blocked(bad) }, { status: 400 });
  // Already written out in full: nothing to fill in. Said plainly, and not counted.
  if (!shortIdea(prompt)) return NextResponse.json({ prompt, improved: false, why: 'long' });
  const admin = isAdmin(request);
  const creator = getCreatorId(request);
  if (!await improveAllowed(creator.id, admin)) return NextResponse.json({ prompt, improved: false, why: 'limit', limit: IMPROVE_DAILY }, { status: 429 });
  const out = await preparePrompt(prompt, { admin, improve: kind });
  const badOut = checkPromptText(out.prompt);
  if (badOut) return NextResponse.json({ error: blocked(badOut) }, { status: 400 });
  return NextResponse.json({ prompt: out.prompt, improved: out.improved, ...(out.improved ? {} : { why: 'busy' }) });
}
