// POST /api/checkout — starts a Stripe card payment.
// Runs on Cloudflare (Pages Functions), never in the customer's browser, so the
// secret keys stay secret. Settings come from Cloudflare → your project →
// Settings → Variables and Secrets (see README → Phase 8).

// Currencies Stripe charges in whole units (no cents).
const ZERO_DECIMAL = new Set(["bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"]);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

class UserError extends Error {}

async function supabaseRpc(env, fn, args) {
  const key = env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // older "service_role" keys
  const res = await fetch(`${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Messages raised by our database (e.g. "Sorry, only 1 left") are safe to show to customers.
    if (res.status === 400 && data && data.code === "P0001") throw new UserError(data.message);
    throw new Error(`Supabase ${fn} failed (${res.status}): ${text}`);
  }
  return data;
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY || !env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
    return json({ error: "Card payments aren't set up yet. Please choose cash on delivery." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const items = Array.isArray(body.items)
    ? body.items.map((i) => ({ perfume_id: String(i.perfume_id || ""), quantity: Number(i.quantity) }))
    : [];

  let order;
  try {
    order = await supabaseRpc(env, "place_card_order", {
      p_name: String(body.name || ""),
      p_phone: String(body.phone || ""),
      p_email: String(body.email || ""),
      p_address: String(body.address || ""),
      p_notes: String(body.notes || ""),
      p_items: items,
    });
  } catch (err) {
    if (err instanceof UserError) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  const currency = String(env.CURRENCY || "usd").toLowerCase();
  const toMinor = (price) => Math.round(Number(price) * (ZERO_DECIMAL.has(currency) ? 1 : 100));
  const origin = new URL(request.url).origin;

  const params = new URLSearchParams({
    mode: "payment",
    success_url: `${origin}/?paid=1&order=${order.id}`,
    cancel_url: `${origin}/?cancelled=1`,
    client_reference_id: String(order.id),
    "metadata[order_id]": String(order.id),
    "payment_intent_data[metadata][order_id]": String(order.id),
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60), // stock is held for ~30 minutes
  });
  if (order.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.email)) params.set("customer_email", order.email);
  order.items.forEach((item, i) => {
    params.set(`line_items[${i}][quantity]`, String(item.quantity));
    params.set(`line_items[${i}][price_data][currency]`, currency);
    params.set(`line_items[${i}][price_data][unit_amount]`, String(toMinor(item.unit_price)));
    params.set(`line_items[${i}][price_data][product_data][name]`, item.name);
  });

  const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    console.error("Stripe error:", JSON.stringify(session));
    await supabaseRpc(env, "cancel_unpaid_order", { p_order_id: order.id, p_session_id: null }).catch(console.error);
    return json({ error: "Card payment couldn't be started. Please try again or choose cash on delivery." }, 502);
  }

  await supabaseRpc(env, "attach_stripe_session", { p_order_id: order.id, p_session_id: session.id });
  return json({ url: session.url, order_id: order.id });
}
