// =====================================================================
//  SCENT DRIP — settings. This is the ONLY file you need to edit.
//  (See README.md → Phase 2 for where to find these values.)
// =====================================================================
window.SCENT_DRIP_CONFIG = {
  // Supabase → Project Settings → API → "Project URL"
  SUPABASE_URL: "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE",

  // Supabase → Project Settings → API Keys → "Publishable key" (or the "anon public" key).
  // This key is SAFE to put on a public website. NEVER paste the "secret" / "service_role" key here.
  SUPABASE_KEY: "PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE",

  // 3-letter currency code: "USD", "LKR", "INR", "PKR", "AED", "GBP", "EUR", ...
  CURRENCY: "USD",

  // Optional: your WhatsApp number with country code, digits only (e.g. "94771234567").
  // Shows a "Chat on WhatsApp" button in the shop. Leave "" to hide it.
  WHATSAPP_NUMBER: "",
};
