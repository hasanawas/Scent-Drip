// Customer-facing shop: lists perfumes, manages the cart, places orders.
(function () {
  const { db, isConfigured, money, esc, toast, setupNotice, cfg } = window.SD;
  const $ = (id) => document.getElementById(id);
  const CART_KEY = "scentdrip_cart";

  let perfumes = [];
  let category = "All";
  let cart = loadCart(); // { [perfumeId]: quantity }

  $("year").textContent = new Date().getFullYear();

  if (cfg.WHATSAPP_NUMBER) {
    const wa = $("whatsapp");
    wa.href = "https://wa.me/" + String(cfg.WHATSAPP_NUMBER).replace(/\D/g, "");
    wa.classList.remove("hidden");
  }

  if (!isConfigured) {
    setupNotice($("main"));
    return;
  }

  // ---------- Cart storage ----------
  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (e) {}
    renderCartCount();
  }

  // ---------- Load perfumes ----------
  async function loadPerfumes() {
    const { data, error } = await db
      .from("perfumes")
      .select("id,name,brand,description,category,size_ml,selling_price,stock,image_url,created_at")
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      $("grid").innerHTML = `<p class="empty">Couldn't load the drip. Please refresh the page.</p>`;
      console.error(error);
      return;
    }
    perfumes = data;

    // Drop cart items that no longer exist and clamp quantities to stock.
    for (const id of Object.keys(cart)) {
      const p = perfumes.find((x) => x.id === id);
      if (!p || p.stock <= 0) delete cart[id];
      else cart[id] = Math.min(cart[id], p.stock);
    }
    saveCart();
    renderChips();
    renderGrid();
  }

  // ---------- Rendering ----------
  function renderChips() {
    const cats = ["All", ...new Set(perfumes.map((p) => p.category).filter(Boolean))];
    $("category-chips").innerHTML = cats
      .map((c) => `<button class="chip ${c === category ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
  }

  function imageHtml(p) {
    return p.image_url
      ? `<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" />`
      : `<img class="placeholder" src="images/logo-mark.png" alt="" />`;
  }

  function stockBadge(p) {
    if (p.stock <= 0) return `<span class="badge">Sold out</span>`;
    if (p.stock <= 3) return `<span class="badge low">Only ${p.stock} left</span>`;
    return "";
  }

  function renderGrid() {
    const q = $("search").value.trim().toLowerCase();
    let list = perfumes.filter(
      (p) =>
        (category === "All" || p.category === category) &&
        (!q || [p.name, p.brand, p.description].some((s) => (s || "").toLowerCase().includes(q)))
    );
    const sort = $("sort").value;
    if (sort === "price-asc") list.sort((a, b) => a.selling_price - b.selling_price);
    if (sort === "price-desc") list.sort((a, b) => b.selling_price - a.selling_price);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));

    if (!list.length) {
      $("grid").innerHTML = `<p class="empty">${perfumes.length ? "No perfumes match your search." : "New drops coming soon ✦"}</p>`;
      return;
    }

    $("grid").innerHTML = list
      .map(
        (p) => `
      <article class="card" data-id="${p.id}">
        <div class="card-img">${imageHtml(p)}${stockBadge(p)}</div>
        <div class="card-body">
          ${p.brand ? `<div class="card-brand">${esc(p.brand)}</div>` : ""}
          <h3 class="card-name">${esc(p.name)}</h3>
          <div class="card-meta">${[p.size_ml ? p.size_ml + " ml" : "", p.category].filter(Boolean).map(esc).join(" · ")}</div>
          <div class="card-foot">
            <span class="price">${money(p.selling_price)}</span>
            <button class="btn small" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${p.stock <= 0 ? "Sold out" : "Add +"}</button>
          </div>
        </div>
      </article>`
      )
      .join("");
  }

  function openProduct(id) {
    const p = perfumes.find((x) => x.id === id);
    if (!p) return;
    $("product-modal").innerHTML = `
      <button class="icon-btn close" data-close aria-label="Close">✕</button>
      <div class="product-detail">
        <div class="card-img">${imageHtml(p)}${stockBadge(p)}</div>
        <div>
          ${p.brand ? `<div class="card-brand">${esc(p.brand)}</div>` : ""}
          <h2>${esc(p.name)}</h2>
          <p class="card-meta">${[p.size_ml ? p.size_ml + " ml" : "", p.category].filter(Boolean).map(esc).join(" · ")}</p>
          <p class="price">${money(p.selling_price)}</p>
          ${p.description ? `<p class="desc">${esc(p.description)}</p>` : ""}
          <button class="btn neon block" data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>
            ${p.stock <= 0 ? "Sold out" : "Add to bag +"}
          </button>
        </div>
      </div>`;
    show("product-modal");
  }

  // ---------- Cart ----------
  function addToCart(id) {
    const p = perfumes.find((x) => x.id === id);
    if (!p) return;
    const current = cart[id] || 0;
    if (current >= p.stock) {
      toast(`Sorry, only ${p.stock} available.`, "error");
      return;
    }
    cart[id] = current + 1;
    saveCart();
    toast(`${p.name} added to bag ✦`, "success");
  }

  function cartLines() {
    return Object.entries(cart)
      .map(([id, qty]) => ({ p: perfumes.find((x) => x.id === id), qty }))
      .filter((l) => l.p);
  }
  const cartTotal = () => cartLines().reduce((s, l) => s + l.p.selling_price * l.qty, 0);

  function renderCartCount() {
    const n = Object.values(cart).reduce((a, b) => a + b, 0);
    $("cart-count").textContent = n;
    $("cart-count").classList.toggle("hidden", n === 0);
  }

  function renderCart() {
    const lines = cartLines();
    $("cart-total").textContent = money(cartTotal());
    $("to-checkout").disabled = lines.length === 0;
    if (!lines.length) {
      $("cart-view").innerHTML = `<p class="empty">Your bag is empty. Go shop the drip ✦</p>`;
      return;
    }
    $("cart-view").innerHTML = lines
      .map(
        ({ p, qty }) => `
      <div class="cart-item">
        ${p.image_url ? `<img src="${esc(p.image_url)}" alt="" />` : `<div class="thumb"><img src="images/logo-mark.png" alt="" /></div>`}
        <div>
          <div class="name">${esc(p.name)}</div>
          <div class="card-meta">${money(p.selling_price)}</div>
          <div class="qty">
            <button data-dec="${p.id}" aria-label="Decrease">−</button><span>${qty}</span><button data-inc="${p.id}" aria-label="Increase">+</button>
          </div>
        </div>
        <div style="text-align:right">
          <div class="price">${money(p.selling_price * qty)}</div>
          <button class="link-btn" data-remove="${p.id}">Remove</button>
        </div>
      </div>`
      )
      .join("");
  }

  function showStep(step) {
    $("cart-view").classList.toggle("hidden", step !== "cart");
    $("cart-foot").classList.toggle("hidden", step !== "cart");
    $("checkout-form").classList.toggle("hidden", step !== "checkout");
    $("success-view").classList.toggle("hidden", step !== "success");
    $("drawer-title").textContent = { cart: "your bag", checkout: "checkout", success: "you're all set" }[step];
    if (step === "cart") renderCart();
    if (step === "checkout") $("checkout-total").textContent = money(cartTotal());
  }

  // ---------- Checkout ----------
  async function placeOrder(e) {
    e.preventDefault();
    const form = e.target;
    if (!form.reportValidity()) return;
    const f = Object.fromEntries(new FormData(form));
    const items = cartLines().map(({ p, qty }) => ({ perfume_id: p.id, quantity: qty }));
    if (!items.length) return showStep("cart");

    const btn = $("place-order");
    btn.disabled = true;
    btn.textContent = "Placing order…";

    const { data: orderId, error } = await db.rpc("place_order", {
      p_name: f.name,
      p_phone: f.phone,
      p_email: f.email,
      p_address: f.address,
      p_notes: f.notes,
      p_items: items,
    });

    btn.disabled = false;
    btn.textContent = "Place order";

    if (error) {
      toast(error.message || "Something went wrong. Please try again.", "error");
      loadPerfumes(); // refresh stock in case that was the problem
      return;
    }

    cart = {};
    saveCart();
    form.reset();
    $("success-view").innerHTML = `
      <div class="success">
        <div class="big">🎉</div>
        <h2>Order #${esc(orderId)} is in 💅</h2>
        <p>Thank you, ${esc(f.name)}! Your new scent is on its way. We'll contact you on <strong>${esc(f.phone)}</strong> to confirm delivery.</p>
        <button class="btn block" data-close>Continue shopping</button>
      </div>`;
    showStep("success");
    loadPerfumes();
  }

  // ---------- Open / close panels ----------
  function show(id) {
    $(id).classList.remove("hidden");
    $("overlay").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }
  function closeAll() {
    ["drawer", "product-modal", "overlay"].forEach((id) => $(id).classList.add("hidden"));
    document.body.style.overflow = "";
  }

  // ---------- Events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-add],[data-inc],[data-dec],[data-remove],[data-close],[data-cat],.card");
    if (!t) return;
    if (t.dataset.add) return addToCart(t.dataset.add);
    if (t.dataset.inc) { addToCart(t.dataset.inc); return renderCart(); }
    if (t.dataset.dec) {
      cart[t.dataset.dec] = (cart[t.dataset.dec] || 1) - 1;
      if (cart[t.dataset.dec] <= 0) delete cart[t.dataset.dec];
      saveCart();
      return renderCart();
    }
    if (t.dataset.remove) { delete cart[t.dataset.remove]; saveCart(); return renderCart(); }
    if (t.hasAttribute("data-close")) return closeAll();
    if (t.dataset.cat) { category = t.dataset.cat; renderChips(); return renderGrid(); }
    if (t.classList.contains("card")) return openProduct(t.dataset.id);
  });

  $("open-cart").onclick = () => { closeAll(); showStep("cart"); show("drawer"); };
  $("close-drawer").onclick = closeAll;
  $("overlay").onclick = closeAll;
  $("to-checkout").onclick = () => showStep("checkout");
  $("back-to-cart").onclick = () => showStep("cart");
  $("checkout-form").addEventListener("submit", placeOrder);
  $("search").addEventListener("input", renderGrid);
  $("sort").addEventListener("change", renderGrid);
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeAll());

  renderCartCount();
  loadPerfumes();
})();
