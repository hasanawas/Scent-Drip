// Entry point when the site runs as a Cloudflare Worker.
// Files (index.html, css, images…) are served automatically; this only
// handles the two payment addresses, using the same code as Pages Functions.
import { onRequestPost as checkout } from "./functions/api/checkout.js";
import { onRequestPost as stripeWebhook } from "./functions/api/stripe-webhook.js";

const routes = {
  "/api/checkout": checkout,
  "/api/stripe-webhook": stripeWebhook,
};

export default {
  async fetch(request, env) {
    const handler = routes[new URL(request.url).pathname];
    if (handler) {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      return handler({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};
