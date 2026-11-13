// What Lemon Squeezy says about the account behind the site's payments, for /admin. Reading only: every request
// here is a GET. The API key never leaves the server and is not part of anything this returns.
const API = 'https://api.lemonsqueezy.com/v1';

async function get(path, key) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 8000);
  try {
    const r = await fetch(`${API}${path}`, { headers: { Accept: 'application/vnd.api+json', Authorization: `Bearer ${key}` }, signal: ctl.signal, cache: 'no-store' });
    const d = await r.json().catch(() => null);
    return r.ok && d ? { d } : { error: r.status === 401 ? 'Lemon Squeezy refused the key (401)' : `Lemon Squeezy answered ${r.status}` };
  } catch (e) { return { error: e?.name === 'AbortError' ? 'Lemon Squeezy did not answer in time' : 'could not reach Lemon Squeezy' }; }
  finally { clearTimeout(timer); }
}

const money = (cents, currency) => (Number.isFinite(Number(cents)) ? `${(Number(cents) / 100).toFixed(2)} ${currency || 'USD'}` : '');

// Turns the three answers (users/me, stores, products) and the two variants the site sells into plain rows.
// Kept apart from the requests so it can be tested with sample answers.
export function readPayInfo({ me, stores, products, variants = [] }, { storeId } = {}) {
  const a = me?.data?.attributes || {};
  // The key decides the mode: a test key sees only test-mode data, a live key only real data.
  const testMode = me?.meta?.test_mode === true ? true : me?.meta?.test_mode === false ? false : null;
  const storeRows = (stores?.data || []).map((s) => {
    const t = s.attributes || {};
    return { id: String(s.id), name: t.name || '', url: t.url || t.domain || '', country: t.country || '', currency: t.currency || '', ours: storeId ? String(s.id) === String(storeId) : false,
      // Lemon Squeezy's API has no documented field for identity verification. Shown only if one of these appears.
      verified: ['verified', 'is_verified', 'identity_verified', 'activated', 'is_activated'].map((k) => t[k]).find((v) => typeof v === 'boolean') ?? null };
  });
  const productRows = (products?.data || []).map((p) => {
    const t = p.attributes || {};
    return { id: String(p.id), name: t.name || '', status: t.status || '', price: t.price_formatted || money(t.price), testMode: typeof t.test_mode === 'boolean' ? t.test_mode : null, storeId: String(t.store_id ?? '') };
  });
  const sold = variants.filter((v) => v && v.plan).map((v) => {
    const t = v.data?.data?.attributes || {};
    const product = productRows.find((p) => p.id === String(t.product_id ?? ''));
    return { plan: v.plan, found: Boolean(v.data?.data), error: v.error || '', variant: t.name || '', product: product?.name || '', price: money(t.price), status: t.status || '', testMode: typeof t.test_mode === 'boolean' ? t.test_mode : null };
  });
  return { email: a.email || '', name: a.name || '', testMode, stores: storeRows, products: productRows, sold };
}

// plans: [{ name, variantId }] the site sells. Returns { configured: false } when this deployment has no key.
export async function payInfo(plans = []) {
  const key = process.env.LEMONSQUEEZY_API_KEY;
  if (!key) return { configured: false };
  const [me, stores, products, ...vs] = await Promise.all([
    get('/users/me', key), get('/stores', key), get('/products?page[size]=50', key),
    ...plans.map((p) => (p.variantId ? get(`/variants/${encodeURIComponent(p.variantId)}`, key) : Promise.resolve({ error: 'no variant id is set for this plan' }))),
  ]);
  if (me.error) return { configured: true, error: me.error };
  const variants = plans.map((p, i) => ({ plan: p.name, data: vs[i]?.d, error: vs[i]?.error }));
  return { configured: true, problems: [stores.error && `stores: ${stores.error}`, products.error && `products: ${products.error}`].filter(Boolean),
    ...readPayInfo({ me: me.d, stores: stores.d, products: products.d, variants }, { storeId: process.env.LEMONSQUEEZY_STORE_ID }) };
}
