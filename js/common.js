// Shared helpers used by both the shop (index.html) and the admin page (admin.html).
(function () {
  const cfg = window.SCENT_DRIP_CONFIG || {};

  const isConfigured =
    typeof cfg.SUPABASE_URL === "string" &&
    cfg.SUPABASE_URL.startsWith("https://") &&
    typeof cfg.SUPABASE_KEY === "string" &&
    !cfg.SUPABASE_KEY.startsWith("PASTE_");

  // Accept the URL with or without extra bits like "/rest/v1/" on the end.
  const supabaseUrl = isConfigured ? new URL(cfg.SUPABASE_URL).origin : "";
  const db = isConfigured ? window.supabase.createClient(supabaseUrl, cfg.SUPABASE_KEY) : null;

  let moneyFmt;
  try {
    moneyFmt = new Intl.NumberFormat(undefined, { style: "currency", currency: cfg.CURRENCY || "USD" });
  } catch (e) {
    moneyFmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
  }
  const money = (n) => moneyFmt.format(Number(n) || 0);

  // Escape text before putting it into the page (protects against malicious input).
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

  let toastTimer;
  function toast(msg, kind = "info") {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.className = "toast " + kind), 3500);
  }

  function setupNotice(container) {
    container.innerHTML = `
      <div class="setup-notice">
        <h2>Almost there! 👋</h2>
        <p>Scent Drip isn't connected to its database yet.</p>
        <p>Open <code>js/config.js</code> and paste your Supabase URL and key
        (see <strong>README.md → Phase 2</strong>).</p>
      </div>`;
  }

  window.SD = { cfg, db, isConfigured, money, esc, toast, setupNotice };
})();
