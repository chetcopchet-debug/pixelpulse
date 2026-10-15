import { NextResponse } from 'next/server';
import { getClientIp } from '../../../lib/credits';
import { getCreatorId } from '../../../lib/identity';
import { isAdmin } from '../../../lib/admin';
import { rateLimit } from '../../../lib/ratelimit';
import { translateIfHebrew, MAX_PROMPT_LENGTH } from '../../../lib/generation';
import { runReplicate, TOOLS } from '../../../lib/replicate';
import { ruleEnhance } from '../../../lib/enhance';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const GUIDE = {
  subtle: 'Keep the idea exactly; add only light, tasteful detail about lighting, composition and texture.',
  bold: 'Keep the core subject; make it vivid and cinematic with strong lighting, mood, camera and color choices.',
  wild: 'Keep the core subject but take it somewhere unexpected, surreal and imaginative with daring visual ideas.',
};

function parseSuggestions(text) {
  const lines = String(text || '').split(/\n+/)
    .map((l) => l.replace(/^\s*(\d+[.)]|[-*•])\s*/, '').replace(/^["“]|["”]$/g, '').trim())
    .filter((l) => l.length > 15 && !/^(here|sure|i |note)/i.test(l));
  return [...new Set(lines)].slice(0, 3).map((l) => l.slice(0, MAX_PROMPT_LENGTH));
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : '';
  const intensity = ['subtle', 'bold', 'wild'].includes(body?.intensity) ? body.intensity : 'bold';
  const creator = getCreatorId(request);
  const ip = getClientIp(request);

  if (!isAdmin(request) && !rateLimit(`amp:${creator.isNew ? ip : creator.id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: 'Amplify limit reached (20/hour). Try again later.' }, { status: 429 });
  }
  const seed = prompt || 'a surprising, beautiful scene';
  const english = await translateIfHebrew(seed);

  if (process.env.REPLICATE_API_TOKEN) {
    const r = await runReplicate({
      model: TOOLS.amplify.model, budgetMs: 40_000,
      input: {
        system_prompt: 'You rewrite ideas into prompts for an AI image generator. The idea may be in any language; always answer in English. Output exactly 3 different prompts, one per line, numbered 1. 2. 3. Each under 60 words. No commentary.',
        prompt: `Idea: ${english}\nOriginal (may be non-English): ${seed}\nIntensity: ${intensity}. ${GUIDE[intensity]}`,
        max_tokens: 400, temperature: intensity === 'wild' ? 0.95 : intensity === 'bold' ? 0.75 : 0.5,
      },
    });
    const text = Array.isArray(r.output) ? r.output.join('') : r.output;
    const suggestions = parseSuggestions(text);
    if (suggestions.length >= 2) return NextResponse.json({ suggestions, source: 'llm', intensity });
    console.error('Amplify LLM fallback:', r.error || 'unparseable output');
  }
  return NextResponse.json({ suggestions: ruleEnhance(english, intensity), source: 'rules', intensity });
}
