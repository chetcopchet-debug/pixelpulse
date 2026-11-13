// Nothing is refused quietly. Every answer that says "no" (not enough credits, a limit, a busy model, an
// error) carries a message for the person, and this wrapper writes one line to the server log with the reason,
// so a refusal can always be found afterwards. A handler that crashes is logged too, and answers with a message.
import { NextResponse } from 'next/server';

export function refusalLog(name, handler) {
  return async (request, ctx) => {
    let res;
    try { res = await handler(request, ctx); }
    catch (e) {
      console.error(`Refused: ${name} 500 crashed: ${String(e?.message || e).slice(0, 200)}`);
      return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
    }
    if (res && res.status >= 400) {
      let why = '';
      try { const d = await res.clone().json(); why = d?.error || d?.why || ''; } catch { /* not JSON */ }
      console.warn(`Refused: ${name} ${res.status} ${String(why).split(' / ')[0].slice(0, 160) || '(no message)'}`);
    }
    return res;
  };
}
