// =====================================================================
//  SCENT DRIP — settings. This is the ONLY file you need to edit.
//  (See README.md → Phase 2 for where to find these values.)
// =====================================================================
window.SCENT_DRIP_CONFIG = {
  // Supabase → Project Settings → API → "Project URL"
  SUPABASE_URL: "https://qfrsatgsnhaygrypheta.supabase.co/rest/v1/",

  // Supabase → Project Settings → API Keys → "Publishable key" (or the "anon public" key).
  // This key is SAFE to put on a public website. NEVER paste the "secret" / "service_role" key here.
  SUPABASE_KEY: "sb_publishable_X4R2DfV9aM071fvja0Shrg_c7pth9qP",

  // 3-letter currency code: "USD", "LKR", "INR", "PKR", "AED", "GBP", "EUR", ...
  CURRENCY: "LKR",

  // Payment options shown at checkout, in this order. "cod" = cash on delivery, "card" = Stripe.
  // Only add "card" after finishing README → Phase 8 (Stripe).
  PAYMENT_METHODS: ["cod", "card"],

  // true while using Stripe TEST keys (shows the test card number at checkout). Set false when you go live.
  STRIPE_TEST_MODE: true,

  // Optional: your WhatsApp number with country code, digits only (e.g. "94771234567").
  // Shows a "Chat on WhatsApp" button in the shop. Leave "" to hide it.
  WHATSAPP_NUMBER: "0770407470",
};
