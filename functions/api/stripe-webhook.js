// POST /api/stripe-webhook — Stripe calls this to tell us a payment succeeded or expired.
// The signature check proves the message really came from Stripe.

const TOLERANCE_SECONDS = 300;

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyStripeSignature(payload, header, secret) {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v);
  if (!t || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - Number(t)) > TOLERANCE_SECONDS) return false;
  const expected = await hmacHex(secret, `${t}.${payload}`);
  return signatures.some((s) => safeEqual(s, expected));
}

async function supabaseRpc(env, fn, args) {
  const key = env.SUPABASE_SECRET_KEY;
  const headers = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`; // older "service_role" keys
  const res = await fetch(`${new URL(env.SUPABASE_URL).origin}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`Supabase ${fn} failed (${res.status}): ${await res.text()}`);
}

export async function onRequestPost({ request, env }) {
  const payload = await request.text();
  const valid = await verifyStripeSignature(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!valid) return new Response("Invalid signature", { status: 400 });

  const event = JSON.parse(payload);
  const session = event.data && event.data.object;
  const orderId = Number(session?.metadata?.order_id || session?.client_reference_id);
  if (!orderId) return new Response("ignored");

  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        if (session.payment_status === "paid") {
          await supabaseRpc(env, "mark_order_paid", { p_order_id: orderId, p_session_id: session.id });
        }
        break;
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed":
        await supabaseRpc(env, "cancel_unpaid_order", { p_order_id: orderId, p_session_id: session.id });
        break;
    }
  } catch (err) {
    console.error(err);
    return new Response("Database error", { status: 500 }); // Stripe will retry
  }
  return new Response("ok");
}
