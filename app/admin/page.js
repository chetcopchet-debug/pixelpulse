import { cookies } from 'next/headers';
import { isAdmin, adminEnabled } from '../../lib/admin';
import { setupChecks, googleEnabled, deploymentKind } from '../../lib/setup';
import { recentJobs } from '../../lib/videoJobs';
import { bump, FREE_SPEND_KEY, DAILY_SPEND_CAP_USD, PAID_SPEND_KEY, HELP_SPEND_CAP_USD, HELP_SPEND_KEY, HELP_FAIL_KEY } from '../../lib/usage';
import { madeWith } from '../studio/models';
import { converterVersion } from '../../lib/transcode';
import { billingWarnings, replicateAccount } from '../../lib/replicate';
import { balanceEstimate, LOW_BALANCE_USD } from '../../lib/balance';
import BalanceForm from './BalanceForm';
import { liveCheck } from '../../lib/modelCheck';
import { payInfo } from '../../lib/payInfo';
import { VIDEO_FROM_IMAGE } from '../../lib/videoPricing';
import { PLANS } from '../../lib/paid';
import { modelHealth } from '../../lib/modelHealth';
import CheckModels from './CheckModels';
import { summarize } from '../../lib/errorLog';
import { getSupabase } from '../../lib/supabase';
import { GALLERY_IMAGES, GALLERY_VIDEOS } from '../../lib/galleryPrompts';
import { IMAGE_MODELS, VIDEO_MODELS } from '../../lib/catalog';
import Page from '../studio/Page';
export const metadata = { title: 'Admin · Yelvo', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const GRANT = { rate: 'Too many grants this hour.', amount: 'Enter a whole number from 1 to 2000.', email: 'That email does not look right.', noacct: 'No account with that email. The person has to sign in once first.', db: 'The database did not answer. Try again.' };
const MSG = { key: 'Wrong key.', rate: 'Too many attempts. Wait 10 minutes.', off: 'Admin is switched off in this deployment: it was built without ADMIN_KEY. See the setup check below.' };

export default async function AdminLogin(props) {
  const sp = await props.searchParams;
  const e = MSG[sp?.e];
  const enabled = adminEnabled();
  const admin = isAdmin({ cookies: await cookies() });
  const g = sp?.g;
  // The setup check is shown to the admin, and to anyone only while admin can't be opened at all
  // (that is exactly when the owner needs to see what is missing). It lists names, never values.
  const showSetup = admin || !enabled;
  const checks = showSetup ? setupChecks() : [];
  const google = showSetup ? await googleEnabled() : false;
  const kind = deploymentKind();
  // Videos: what happened to the latest runs, and whether Replicate's calls reach this deployment.
  const videos = admin ? await recentJobs(10).catch(() => []) : [];
  const hooks = admin ? Number(await bump('hook:replicate', 0, 1e9).catch(() => 0)) || 0 : 0;
  // Today in numbers, and what went wrong (lib/errorLog.js). Both come from tables the site already has.
  const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
  const todayUtc = dayOf(Date.now()), yesterdayUtc = dayOf(Date.now() - 86_400_000), weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  let errors = [], numbers = null;
  const sbAdmin = admin ? getSupabase() : null;
  if (sbAdmin) {
    const count = async (table, build) => { const { count: n, error } = await build(sbAdmin.from(table).select('*', { count: 'exact', head: true })); return error ? null : n; };
    const since = (iso) => (q) => q.gte('created_at', iso);
    const start = `${todayUtc}T00:00:00Z`;
    const [er, a1, a7, i1, i7, v1, v7, p1, p7] = await Promise.all([
      sbAdmin.from('usage_counters').select('key, day, amount').like('key', 'err:%').gte('day', yesterdayUtc).limit(1000),
      count('accounts', since(start)), count('accounts', since(weekAgo)),
      count('images', (q) => q.gte('created_at', start).not('storage_path', 'like', '%.mp4').neq('model', 'upload')), count('images', (q) => q.gte('created_at', weekAgo).not('storage_path', 'like', '%.mp4').neq('model', 'upload')),
      count('images', (q) => q.gte('created_at', start).like('storage_path', '%.mp4')), count('images', (q) => q.gte('created_at', weekAgo).like('storage_path', '%.mp4')),
      count('payment_events', (q) => q.gte('created_at', start).in('kind', ['pack', 'pro'])), count('payment_events', (q) => q.gte('created_at', weekAgo).in('kind', ['pack', 'pro'])),
    ]).catch(() => []);
    errors = er && !er.error ? summarize(er.data, todayUtc, yesterdayUtc) : [];
    numbers = [['New accounts', a1, a7], ['Images made', i1, i7], ['Videos made', v1, v7], ['Purchases', p1, p7]];
  }
  // What the models cost us so far today (UTC), as counted by the daily limit.
  const spentToday = admin ? Math.max(0, Number(await bump(FREE_SPEND_KEY, 0, 1e9).catch(() => 0)) || 0) : 0; // on free credits: what the limit counts
  const helpToday = admin ? Math.max(0, Number(await bump(HELP_SPEND_KEY, 0, 1e9).catch(() => 0)) || 0) : 0; // translating and the free improvement
  const helpFails = admin ? Math.max(0, Number(await bump(HELP_FAIL_KEY, 0, 1e9).catch(() => 0)) || 0) : 0; // in a row, without an answer from a model
  const paidToday = admin ? Math.max(0, Number(await bump(PAID_SPEND_KEY, 0, 1e9).catch(() => 0)) || 0) : 0; // paid work: counted, never limited
  const bypass = Boolean(process.env.VERCEL_AUTOMATION_BYPASS_SECRET);
  const converter = showSetup ? await converterVersion().catch(() => null) : null;
  // Replicate: the API does not report the balance, so the page shows what Replicate's own refusals said today.
  const money = admin ? await billingWarnings().catch(() => ({ low: 0, empty: 0 })) : { low: 0, empty: 0 };
  const bal = admin ? await balanceEstimate().catch(() => null) : null; // what the owner typed in, less what the site counted since
  const account = admin ? await replicateAccount() : null;
  // Payments: what Lemon Squeezy says about the account, the store and the products. Reading only.
  const pay = admin ? await payInfo(Object.values(PLANS).map((pl) => ({ name: pl.name, variantId: process.env[pl.env] }))).catch(() => ({ configured: true, error: 'could not read Lemon Squeezy' })) : null;
  const mode = (t) => (t === true ? 'test mode' : t === false ? 'live' : 'mode not reported');
  // Models: the price each one is charged at, whether that price was confirmed on Replicate, and whether Replicate
  // still has the model and accepts the inputs we send (asked live, cached for an hour).
  const models = admin ? await liveCheck().catch(() => []) : [];
  const unverified = models.filter((m) => m.approx);
  const broken = models.filter((m) => m.ok === false);
  // Whether each model still runs: learned from real refusals, from the daily check and from the button below.
  const health = admin ? await modelHealth().catch(() => ({ dead: new Set(), seen: {}, trouble: {} })) : { dead: new Set(), seen: {}, trouble: {} };
  const today = new Date().toISOString().slice(0, 10);
  // Asked today, and Replicate answered with an error of its own instead of yes or no.
  const shaky = (slug) => health.trouble?.[slug] === today && health.seen[slug] !== today && !health.dead.has(slug);
  const gone = models.filter((m) => health.dead.has(m.slug));
  const when = (t) => new Date(t).toLocaleString('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  const galleryCost = [...GALLERY_IMAGES, ...GALLERY_VIDEOS].reduce((t, g) => {
    const m = (g.group === 'Video' ? VIDEO_MODELS : IMAGE_MODELS).find((x) => x.id === g.model);
    return m ? { usd: t.usd + m.usd, credits: t.credits + m.cost } : t;
  }, { usd: 0, credits: 0 });
  return (
    <Page bare>
      <h1>Admin</h1>

      {enabled ? (
        <form className="form" method="post" action="/api/admin" autoComplete="off" style={{ marginTop: 16 }}>
          <input className="field" name="key" type="password" required placeholder="Admin key" aria-label="Admin key" />
          <button className="btn btn-p" type="submit">Enter</button>
          {e && <p className="sm bad" role="alert">{e}</p>}
          {admin && <p className="sm ok">Admin mode is on in this browser. Nothing is charged while it is on. <a className="link" href="/">Open the site</a></p>}
        </form>
      ) : (
        <p className="notice" style={{ marginTop: 16 }} role="alert">Admin is switched off here because this deployment has no ADMIN_KEY. Add it in Vercel for this environment ({kind}), then redeploy: a deployment only sees the settings that existed when it was built.</p>
      )}

      {admin && (
        <>
          <h2 className="sec">Add bought credits</h2>
          <form className="form" method="post" action="/api/admin/grant" autoComplete="off">
            <p className="sm t2">For testing or support. Leave the email empty to add them to this browser. Then log out of admin below, because admin mode never spends credits.</p>
            <input className="field" name="amount" type="number" inputMode="numeric" min="1" max="2000" required placeholder="How many credits (1 to 2000)" aria-label="How many credits" />
            <input className="field" name="email" type="email" placeholder="Account email (optional)" aria-label="Account email (optional)" />
            <button className="btn btn-s" type="submit">Add credits</button>
            {g === 'ok' && <p className="sm ok" role="status">Added {String(sp?.n || '').replace(/\D/g, '')} credits to {sp?.t === 'email' ? 'that account' : 'this browser'}. Bought balance now: {String(sp?.b || '').replace(/\D/g, '')}.</p>}
            {g && g !== 'ok' && GRANT[g] && <p className="sm bad" role="alert">{GRANT[g]}</p>}
          </form>
        </>
      )}

      {admin && (
        <>
          <h2 className="sec">Today in numbers</h2>
          <div className="ptable">
            <div className="head"><span className="grow">Since midnight UTC</span><span>Today</span><span style={{ minWidth: 64, textAlign: 'right' }}>7 days</span></div>
            {(numbers || []).map(([name, d, w]) => <div key={name}><span className="grow b">{name}</span><span className="b num">{d ?? '?'}</span><span className="t2 num" style={{ minWidth: 64, textAlign: 'right' }}>{w ?? '?'}</span></div>)}
          </div>

          <h2 className="sec">What went wrong</h2>
          {errors.length === 0 ? <p className="t2">No errors were counted today or yesterday.</p> : (
            <>
              <p className="t2" style={{ marginBottom: 10 }}>Every error the server reports and every error in a visitor's browser, grouped by message. Safety, low balance and rate limit come first. Numbers, ids and addresses are removed. {errors.reduce((n, e) => n + e.today, 0)} today, {errors.reduce((n, e) => n + e.yesterday, 0)} yesterday.</p>
              <div className="ptable">
                <div className="head"><span className="grow">Where and what</span><span>Today</span><span style={{ minWidth: 64, textAlign: 'right' }}>Yesterday</span></div>
                {errors.slice(0, 25).map((e) => (
                  <div key={e.where + e.message}>
                    <span className="grow"><span className="sm t2" style={{ display: 'block' }}>{e.kind ? <b style={{ display: 'inline-block', marginRight: 6, padding: '0 6px', borderRadius: 6, color: '#000', background: e.kind === 'safety' ? '#FF7A7A' : e.kind === 'balance' ? '#FFC24D' : '#7FC8FF' }}>{e.kind === 'safety' ? 'Safety' : e.kind === 'balance' ? 'Low balance' : 'Rate limit'}</b> : null}{e.where === 'browser' ? "In a visitor's browser" : e.where === 'crash' ? 'A request crashed' : 'On the server'}</span><span style={{ overflowWrap: 'anywhere' }}>{e.message}</span></span>
                    <span className={`b num ${e.today ? 'bad' : 't3'}`}>{e.today}</span><span className="t2 num" style={{ minWidth: 64, textAlign: 'right' }}>{e.yesterday}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <h2 className="sec">Daily spending limit</h2>
          {spentToday < DAILY_SPEND_CAP_USD && spentToday >= 0.8 * DAILY_SPEND_CAP_USD && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>Free creations are close to today's limit:</b> ${spentToday.toFixed(2)} of ${DAILY_SPEND_CAP_USD.toFixed(2)}. Past it, creating with free credits pauses until midnight UTC.</p>}
          {helpToday >= 0.8 * HELP_SPEND_CAP_USD && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>{helpToday >= HELP_SPEND_CAP_USD ? 'Translating and free improving are paused for today.' : "Translating and free improving are close to today's limit:"}</b> ${helpToday.toFixed(2)} of ${HELP_SPEND_CAP_USD.toFixed(2)}. {helpToday >= HELP_SPEND_CAP_USD ? 'Prompts are used as written and people are told so. Paid work is not affected.' : ''}</p>}
          {helpFails >= 3 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>{helpFails} translations or improvements in a row got no answer from a model.</b> Check the Replicate account (balance, slow-down notices) and the server log (lines that start with "Translate:").</p>}
          {spentToday >= DAILY_SPEND_CAP_USD && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>Today's limit is reached.</b> Creating with free credits is paused until midnight UTC. Bought credits keep working.</p>}
          <div className="ptable">
            <div>
              <span className="grow">
                <span className="b">${spentToday.toFixed(2)} of ${DAILY_SPEND_CAP_USD.toFixed(2)} today on free credits</span>
                <span className="sm t2" style={{ display: 'block' }}>Paid work today: ${paidToday.toFixed(2)}. It is not part of the limit.</span>
                <span className="sm t2" style={{ display: 'block' }}>Translating and free improving today: ${helpToday.toFixed(2)} of ${HELP_SPEND_CAP_USD.toFixed(2)} (a limit of their own).</span>
                <span className="sm t2" style={{ display: 'block' }}>Everything the models cost today is counted. When it passes the limit, creating with <b>free</b> credits pauses until midnight UTC, so free use can never cost more than this in a day. Creations paid with bought credits are never stopped by it.</span>
                <span className="sm t2" style={{ display: 'block' }}>To change the limit, set DAILY_SPEND_CAP_USD in Vercel's environment variables and redeploy.</span>
              </span>
              <span className={`b sm ${spentToday >= DAILY_SPEND_CAP_USD ? 'bad' : 'ok'}`}>{spentToday >= DAILY_SPEND_CAP_USD ? 'Paused' : `${Math.max(0, Math.round((1 - spentToday / (DAILY_SPEND_CAP_USD || 1)) * 100))}% left`}</span>
            </div>
          </div>

          <h2 className="sec">Replicate account</h2>
          {bal && bal.low && money.empty === 0 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>The Replicate balance is estimated at ${bal.left.toFixed(2)}, under ${LOW_BALANCE_USD}.</b> Add credit soon: below $5 Replicate slows the site down. After adding, type the new balance below.</p>}
          {money.empty > 0 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>The Replicate balance is used up.</b> Replicate refused {money.empty} {money.empty === 1 ? 'run' : 'runs'} today for lack of credit. Nothing can be generated until credit is added.</p>}
          {money.empty === 0 && money.low > 0 && <p className="notice" role="alert" style={{ marginBottom: 10 }}><b>The Replicate balance is under $5.</b> Replicate slowed down {money.low} {money.low === 1 ? 'start' : 'starts'} today: below $5 it allows 6 starts a minute, one at a time. The site waits and retries, but people will see delays and some failures until credit is added.</p>}
          <div className="ptable">
            <div>
              <span className="grow"><span className="b">Account</span><span className="sm t2" style={{ display: 'block' }}>{account?.name ? `The API token belongs to ${account.name}${account.type ? ` (${account.type})` : ''}.` : account?.error ? `${account.error}. The token may be wrong or revoked.` : 'Replicate did not answer just now.'}</span></span>
              <span className={`b sm ${account?.name ? 'ok' : 'bad'}`}>{account?.name ? 'Connected' : 'Problem'}</span>
            </div>
            <div>
              <span className="grow"><span className="b">Balance</span>
                {bal ? <span className="sm t2" style={{ display: 'block' }}>About <b>${bal.left.toFixed(2)}</b> left. An estimate: ${bal.entered.toFixed(2)} typed in on {bal.since}, less ${bal.spent.toFixed(2)} the site has counted since. Replicate&apos;s real charges can differ a little, so correct it from time to time.</span>
                  : <span className="sm t2" style={{ display: 'block' }}>Replicate does not give the balance through its API. Type it in once and this line will estimate what is left, and warn under ${LOW_BALANCE_USD}.</span>}
                <span className="sm t2" style={{ display: 'block' }}>Replicate&apos;s own notices (under $5, or empty) also turn this line into a warning. <a className="link" href="https://replicate.com/account/billing" target="_blank" rel="noreferrer">Open Replicate billing</a></span>
                <BalanceForm has={Boolean(bal)} />
              </span>
              <span className={`b sm ${money.empty > 0 || money.low > 0 || bal?.low ? 'bad' : 'ok'}`} style={{ whiteSpace: 'nowrap' }}>{money.empty > 0 ? 'Empty' : money.low > 0 ? 'Under $5' : bal ? (bal.low ? `About $${bal.left.toFixed(2)}` : `About $${bal.left.toFixed(2)}`) : 'No warnings today'}</span>
            </div>
          </div>

          <h2 className="sec">Payments</h2>
          {!pay?.configured ? <p className="t2">This deployment has no Lemon Squeezy key, so there is nothing to read here. The key is set for the real site only.</p>
            : pay.error ? <p className="notice bad" role="alert">Lemon Squeezy could not be read: {pay.error}.</p> : (
              <>
                {pay.testMode === true && <p className="notice" role="alert" style={{ marginBottom: 10 }}><b>The site&apos;s key is a test-mode key.</b> Purchases on the site are test purchases: no real money moves. For real sales, the key, the store id and the two variant ids must be the live ones.</p>}
                {(pay.problems || []).length > 0 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}>Part of the answer is missing: {pay.problems.join('; ')}.</p>}
                <div className="ptable">
                  <div>
                    <span className="grow"><span className="b">Account</span><span className="sm t2" style={{ display: 'block', overflowWrap: 'anywhere' }}>{pay.email || 'No email in the answer'}{pay.name ? ` (${pay.name})` : ''}</span></span>
                    <span className={`b sm ${pay.testMode === false ? 'ok' : pay.testMode === true ? 'bad' : 't3'}`} style={{ whiteSpace: 'nowrap' }}>{pay.testMode === false ? 'Live key' : pay.testMode === true ? 'Test key' : 'Mode unknown'}</span>
                  </div>
                  {pay.stores.length === 0 ? <div><span className="grow t2">No store in the answer.</span></div> : pay.stores.map((st) => (
                    <div key={st.id}>
                      <span className="grow"><span className="b">Store: {st.name || st.id}</span><span className="sm t2" style={{ display: 'block', overflowWrap: 'anywhere' }}>{[st.url, st.country, st.currency].filter(Boolean).join(', ')}{st.ours ? '. This is the store the site sells from.' : ''}</span>
                        <span className="sm t3" style={{ display: 'block' }}>Identity verification: {st.verified === true ? 'completed' : st.verified === false ? 'not completed' : 'Lemon Squeezy does not report it here. Look in its dashboard, under Settings.'}</span></span>
                      <span className={`b sm ${st.ours ? 'ok' : 't3'}`}>{st.ours ? 'In use' : 'Other'}</span>
                    </div>
                  ))}
                  {pay.sold.map((v) => (
                    <div key={v.plan}>
                      <span className="grow"><span className="b">The site sells: {v.plan}</span><span className="sm t2" style={{ display: 'block' }}>{v.found ? `At Lemon Squeezy: "${v.product || 'unknown product'}"${v.variant ? `, variant "${v.variant}"` : ''}, ${v.price || 'no price'}, ${v.status || 'no state'}, ${mode(v.testMode)}.` : `Not found at Lemon Squeezy: ${v.error || 'no answer'}.`}</span></span>
                      <span className={`b sm ${v.found && v.status === 'published' ? 'ok' : 'bad'}`}>{v.found ? (v.status === 'published' ? 'Ready' : v.status || 'Check') : 'Missing'}</span>
                    </div>
                  ))}
                </div>
                <p className="sm t2" style={{ margin: '10px 0 6px' }}>Every product the key can see ({mode(pay.testMode)}). A key sees one mode only: a live key shows real products, a test key shows test products.</p>
                <div className="ptable">
                  {pay.products.length === 0 ? <div><span className="grow t2">No products in the answer.</span></div> : pay.products.map((pr) => (
                    <div key={pr.id}>
                      <span className="grow"><span className="b">{pr.name || pr.id}</span><span className="sm t2" style={{ display: 'block' }}>{[pr.price, mode(pr.testMode)].filter(Boolean).join(', ')}</span></span>
                      <span className={`b sm ${pr.status === 'published' ? 'ok' : 't3'}`}>{pr.status || 'unknown'}</span>
                    </div>
                  ))}
                </div>
                <p className="sm t3" style={{ marginTop: 8 }}>Read from Lemon Squeezy each time this page opens. Nothing is changed there, and the key is not shown.</p>
              </>
            )}

          <h2 className="sec">Prompts for the Explore gallery</h2>
          <p className="t2" style={{ marginBottom: 10 }}>{GALLERY_IMAGES.length} images and {GALLERY_VIDEOS.length} videos. "Use" opens Create with the prompt, model and shape filled in; you still tap Generate yourself. When a result is good, open it in your Library and tap "Show in Explore". Making all of them once costs about <b>${galleryCost.usd.toFixed(2)}</b> at Replicate ({galleryCost.credits.toLocaleString('en-US')} credits; nothing is charged in admin mode).</p>
          <details className="gp">
            <summary className="b">Show the {GALLERY_IMAGES.length + GALLERY_VIDEOS.length} prompts</summary>
            <div className="ptable" style={{ marginTop: 10 }}>
              {[...GALLERY_IMAGES, ...GALLERY_VIDEOS].map((g) => {
                const video = g.group === 'Video';
                const m = (video ? VIDEO_MODELS : IMAGE_MODELS).find((x) => x.id === g.model);
                const href = video ? `/?p=${encodeURIComponent(g.prompt)}&video=${g.model}&ratio=${encodeURIComponent(g.ratio)}` : `/?p=${encodeURIComponent(g.prompt)}&vibe=1&tier=${g.model}&ratio=${encodeURIComponent(g.ratio)}`;
                return (
                  <div key={g.title}>
                    <span className="grow">
                      <span className="b">{g.group}: {g.title}</span>
                      <span className="sm t2" style={{ display: 'block' }}>{m ? m.label : g.model}, {g.ratio}, {m ? m.cost : '?'} credits</span>
                      <span className="sm" style={{ display: 'block', marginTop: 4 }}>{g.prompt}</span>
                    </span>
                    <a className="btn btn-s" style={{ height: 44, padding: '0 14px', flex: 'none' }} href={href}>Use</a>
                  </div>
                );
              })}
            </div>
          </details>

          <h2 className="sec">Models and prices</h2>
          {gone.length > 0 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>Discontinued by {gone.length === 1 ? 'its' : 'their'} provider: {gone.map((m) => m.name).join(', ')}.</b> Replicate refuses every run. The site shows {gone.length === 1 ? 'it' : 'them'} as "Temporarily unavailable" and Auto does not pick {gone.length === 1 ? 'it' : 'them'}. Replicate is asked again every day, and {gone.length === 1 ? 'it comes' : 'they come'} back by {gone.length === 1 ? 'itself' : 'themselves'} when it answers.</p>}
          <CheckModels models={models.map((m) => ({ slug: m.slug, name: m.name, kind: m.kind }))} />
          {broken.length > 0 && <p className="notice bad" role="alert" style={{ marginBottom: 10 }}><b>{broken.length} {broken.length === 1 ? 'model needs' : 'models need'} attention.</b> Replicate no longer accepts what the site sends, so generations with {broken.length === 1 ? 'it' : 'them'} will fail and be refunded.</p>}
          {unverified.length > 0 && <p className="notice" style={{ marginBottom: 10 }}><b>{unverified.length} prices are not verified.</b> They are the maker's list price, not a price read on Replicate, so they are charged with 15% on top. To verify one, open its Replicate page, find the price, and tell Claude.</p>}
          <div className="ptable">
            <div className="head"><span className="grow">Model, and what one run costs us</span><span>Credits</span></div>
            {models.map((m) => (
              <div key={m.kind + m.id}>
                <span className="grow">
                  <span className="b">{m.name}</span>
                  <span className="sm t2" style={{ display: 'block' }}>
                    <a className="link" href={`https://replicate.com/${m.slug}`} target="_blank" rel="noreferrer">{m.slug}</a>
                  </span>
                  {m.tool ? <span className="sm t2" style={{ display: 'block' }}>Used by a tool</span> : <>
                  <span className="sm t2" style={{ display: 'block' }}>${m.usd < 1 ? m.usd.toFixed(3) : m.usd.toFixed(2)} for {m.unit}. Source: {m.src}</span>
                  <span className={`sm ${m.approx ? 'bad' : 'ok'}`} style={{ display: 'block' }}>{m.approx ? `Price not verified: list price $${m.listUsd} plus 15%` : 'Price verified'}</span></>}
                  <span className={`sm ${health.dead.has(m.slug) || shaky(m.slug) ? 'bad' : health.seen[m.slug] ? 'ok' : 't3'}`} style={{ display: 'block' }}>{health.dead.has(m.slug) ? 'Discontinued by its provider: Replicate refuses every run' : shaky(m.slug) ? `Replicate answered today's check with an error of its own (500). Not discontinued. It may pass; until then a run on this model may fail (credits come back).${health.seen[m.slug] ? ` Last seen running ${health.seen[m.slug]}.` : ''}` : health.seen[m.slug] ? `Running. Last checked ${health.seen[m.slug]}` : 'Not checked yet whether it still runs'}</span>
                  {health.down?.has(m.slug) ? <span className="sm bad" style={{ display: 'block' }}>Down: its runs fail. Shown to visitors as "Temporarily unavailable". One real image is tried every day; it comes back when one succeeds.</span> : null}
                  {health.resting?.[m.slug] ? <span className="sm bad" style={{ display: 'block' }}>Resting: {health.resting[m.slug]} runs in a row failed in the last hour. Shown to visitors as "Temporarily unavailable"; it comes back by itself within the hour, or at once when a run works.</span> : null}
                  <span className={`sm ${m.ok === true ? 'ok' : m.ok === false ? 'bad' : 't3'}`} style={{ display: 'block' }}>{m.ok === true ? (m.tool ? 'Replicate has this model' : 'Replicate accepts our inputs') : m.ok === false ? `Problem: ${m.problems.join('; ')}` : `Not checked: ${m.problems.join('; ')}`}</span>
                </span>
                {m.tool ? null : <span className="price"><i className="coin" />{m.cost}</span>}
              </div>
            ))}
          </div>

          <h2 className="sec">Latest videos</h2>
          <p className="sm t2" style={{ marginBottom: 10 }}>Times are UTC. "Saved" means the stored file was read back and is a video. Calls from Replicate received today: <b>{hooks}</b>.{kind !== 'production' && !bypass ? ' On a preview behind Vercel\'s login wall those calls are blocked unless "Protection Bypass for Automation" is switched on in Vercel (Settings, Deployment Protection); videos are then saved when you come back to the site instead.' : ''}</p>
          <div className="ptable">
            {videos.length === 0 && <div><span className="grow t2">No videos yet.</span></div>}
            {videos.map((v) => {
              const bad = v.status === 'failed' || (v.file && !v.file.ok && !v.file.unsure);
              const label = v.status === 'processing' ? 'Rendering' : v.status === 'failed' ? (v.refunded ? 'Failed, refunded' : 'Failed') : v.file && !v.file.ok && !v.file.unsure ? 'File broken' : 'Saved';
              const detail = v.status === 'done'
                ? `${v.file ? (v.file.ok ? `File check passed: ${Math.round((v.file.size || 0) / 1024)} KB, ${v.file.type || 'video'}` : `File check: ${v.file.why}`) : 'Saved'}${v.error ? `. Note: ${v.error}` : ''}`
                : (v.error || (v.status === 'processing' ? 'Waiting for the model' : 'No reason recorded'));
              return (
                <div key={v.id}>
                  <span className="grow" style={{ minWidth: 0 }}><span className="b">{madeWith(v.kind)}</span> <span className="sm t3 num">{when(v.at)} · {v.cost} credits</span><span className="sm t2" style={{ display: 'block', overflowWrap: 'anywhere' }}>{detail}</span></span>
                  <span className={`b sm ${bad ? 'bad' : v.status === 'processing' ? 't3' : 'ok'}`} style={{ whiteSpace: 'nowrap' }}>{label}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showSetup && (
        <>
          <h2 className="sec">Setup check</h2>
          <p className="sm t2" style={{ marginBottom: 10 }}>This deployment is a <b>{kind}</b> build. Each line is a setting it was built with. A missing one has to be added in Vercel (Settings, Environment Variables) with "{kind === 'production' ? 'Production' : 'Preview'}" ticked, followed by a new deployment.</p>
          <div className="ptable">
            {checks.map((c) => (
              <div key={c.name}>
                <span className="grow"><span className="b">{c.name}</span><span className="sm t2" style={{ display: 'block' }}>{c.ok ? c.why : `Missing: ${c.missing.join(', ')}. ${c.why}`}</span></span>
                <span className={`b sm ${c.ok ? 'ok' : c.optional ? 't3' : 'bad'}`}>{c.ok ? 'Set' : c.optional ? 'Not set' : 'Missing'}</span>
              </div>
            ))}
            <div>
              <span className="grow"><span className="b">Video converter</span><span className="sm t2" style={{ display: 'block' }}>{converter ? `${converter}. Every saved video is brought to H.264 with the index first, the format phones play.` : 'ffmpeg did not start in this deployment, so videos are saved exactly as the model made them and some may not play on phones.'}</span></span>
              <span className={`b sm ${converter ? 'ok' : 'bad'}`}>{converter ? 'Ready' : 'Missing'}</span>
            </div>
            <div>
              <span className="grow"><span className="b">Google sign-in</span><span className="sm t2" style={{ display: 'block' }}>{google ? 'Switched on in Supabase. The Google button is shown.' : 'Supabase did not report Google as switched on, so the button is hidden. Check Supabase, Authentication, Sign In / Providers, Google.'}</span></span>
              <span className={`b sm ${google ? 'ok' : 't3'}`}>{google ? 'On' : 'Off'}</span>
            </div>
          </div>
          {kind !== 'production' && <p className="sm t2" style={{ marginTop: 10 }}>Sign-in on a preview also needs this address pattern in Supabase (Authentication, URL Configuration, Redirect URLs): <b>https://*-caissa3.vercel.app/**</b></p>}
        </>
      )}

      <div className="r" style={{ gap: 20, marginTop: 28, flexWrap: 'wrap' }}>
        <a className="link sm r" style={{ minHeight: 44 }} href="/admin/reports">Reports queue</a>
        {admin && <form method="post" action="/api/admin"><input type="hidden" name="logout" value="1" /><button className="link sm t2" style={{ minHeight: 44 }} type="submit">Log out of admin</button></form>}
      </div>
    </Page>
  );
}
