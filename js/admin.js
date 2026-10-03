// Admin dashboard: login, orders, inventory (add / edit / remove perfumes).
(function () {
  const { db, isConfigured, money, esc, toast, setupNotice } = window.SD;
  const $ = (id) => document.getElementById(id);
  const BUCKET = "perfume-images";
  const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"];

  let perfumes = [];
  let orders = [];
  let channel = null;

  if (!isConfigured) {
    setupNotice($("main"));
    return;
  }

  // =================== Auth ===================
  async function start() {
    const { data } = await db.auth.getSession();
    if (data.session) await enter();
    else showLogin();
  }

  function showLogin() {
    $("login-form").classList.remove("hidden");
    $("dashboard").classList.add("hidden");
    $("logout").classList.add("hidden");
  }

  async function enter() {
    const { data: ok, error } = await db.rpc("is_admin");
    if (error || !ok) {
      await db.auth.signOut();
      showLogin();
      toast("This account is not an admin. See README → Phase 1, step 5.", "error");
      return;
    }
    $("login-form").classList.add("hidden");
    $("dashboard").classList.remove("hidden");
    $("logout").classList.remove("hidden");
    await Promise.all([loadOrders(), loadInventory()]);
    listenForOrders();
  }

  $("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const btn = e.target.querySelector("button");
    btn.disabled = true;
    const { error } = await db.auth.signInWithPassword({ email: f.email.trim(), password: f.password });
    btn.disabled = false;
    if (error) return toast("Login failed: " + error.message, "error");
    e.target.reset();
    enter();
  });

  $("logout").onclick = async () => {
    if (channel) db.removeChannel(channel);
    await db.auth.signOut();
    showLogin();
  };

  // =================== Tabs ===================
  document.querySelectorAll(".tab").forEach((t) =>
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === t));
      $("tab-orders").classList.toggle("hidden", t.dataset.tab !== "orders");
      $("tab-inventory").classList.toggle("hidden", t.dataset.tab !== "inventory");
    })
  );

  // =================== Orders ===================
  async function loadOrders() {
    const { data, error } = await db
      .from("orders")
      .select("*, order_items(*)")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return toast("Couldn't load orders: " + error.message, "error");
    orders = data;
    renderOrders();
  }

  const orderProfit = (o) =>
    o.order_items.reduce((s, i) => s + (i.unit_price - (i.unit_cost ?? 0)) * i.quantity, 0);

  // Card orders count once Stripe confirms payment; cash orders count right away.
  const isReal = (o) => !["pending", "failed"].includes(o.payment_status);

  function paymentBadge(o) {
    if (o.payment_method !== "card") return `<span class="pay-badge">💵 Cash on delivery</span>`;
    if (o.payment_status === "paid") return `<span class="pay-badge paid">💳 Paid by card</span>`;
    if (o.payment_status === "pending") return `<span class="pay-badge pending">⏳ Waiting for card payment</span>`;
    return `<span class="pay-badge failed">✕ Card payment not completed</span>`;
  }

  function renderOrders() {
    const live = orders.filter((o) => o.status !== "cancelled" && isReal(o));
    const delivered = orders.filter((o) => o.status === "delivered" && isReal(o));
    const newCount = orders.filter((o) => o.status === "new" && isReal(o)).length;

    $("new-count").textContent = newCount;
    $("new-count").classList.toggle("hidden", newCount === 0);

    $("order-stats").innerHTML = [
      ["New orders", newCount],
      ["Total orders", live.length],
      ["Sales (all active orders)", money(live.reduce((s, o) => s + Number(o.total), 0))],
      ["Profit (all active orders)", money(live.reduce((s, o) => s + orderProfit(o), 0)), "pos"],
      ["Delivered sales", money(delivered.reduce((s, o) => s + Number(o.total), 0))],
      ["Delivered profit", money(delivered.reduce((s, o) => s + orderProfit(o), 0)), "pos"],
    ]
      .map(([l, v, c]) => `<div class="stat"><div class="label">${l}</div><div class="value ${c || ""}">${v}</div></div>`)
      .join("");

    const filter = $("status-filter").value;
    const list = filter ? orders.filter((o) => o.status === filter) : orders;
    if (!list.length) {
      $("orders-list").innerHTML = `<p class="empty">No ${filter || ""} orders yet.</p>`;
      return;
    }

    $("orders-list").innerHTML = list
      .map(
        (o) => `
      <div class="order st-${o.status} ${isReal(o) ? "" : "unpaid"}">
        <div class="order-head">
          <h3>Order #${o.id} <span class="when">${new Date(o.created_at).toLocaleString()}</span></h3>
          <select class="input" style="width:auto" data-order="${o.id}" aria-label="Order status">
            ${STATUSES.map((s) => `<option value="${s}" ${s === o.status ? "selected" : ""}>${s[0].toUpperCase() + s.slice(1)}</option>`).join("")}
          </select>
        </div>
        <div class="order-grid">
          <div>
            <ul>${o.order_items.map((i) => `<li>${i.quantity} × ${esc(i.perfume_name)} — ${money(i.unit_price * i.quantity)}</li>`).join("")}</ul>
            <p><strong>Total: ${money(o.total)}</strong> · <span class="pos">Profit ${money(orderProfit(o))}</span><br />
            ${paymentBadge(o)}</p>
          </div>
          <div>
            <strong>${esc(o.customer_name)}</strong><br />
            📞 <a href="tel:${esc(o.customer_phone)}">${esc(o.customer_phone)}</a>
            · <a href="https://wa.me/${esc(o.customer_phone.replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a><br />
            ${o.customer_email ? `✉️ <a href="mailto:${esc(o.customer_email)}">${esc(o.customer_email)}</a><br />` : ""}
            📍 ${esc(o.address)}
            ${o.notes ? `<br /><span class="muted">📝 ${esc(o.notes)}</span>` : ""}
          </div>
        </div>
      </div>`
      )
      .join("");
  }

  $("status-filter").addEventListener("change", renderOrders);

  $("orders-list").addEventListener("change", async (e) => {
    const sel = e.target.closest("[data-order]");
    if (!sel) return;
    const id = Number(sel.dataset.order);
    const status = sel.value;
    if (status === "cancelled" && !confirm(`Cancel order #${id}? Its perfumes will go back into stock.`)) {
      sel.value = orders.find((o) => o.id === id).status;
      return;
    }
    const { error } = await db.from("orders").update({ status }).eq("id", id);
    if (error) {
      toast("Couldn't update: " + error.message, "error");
      sel.value = orders.find((o) => o.id === id).status;
      return;
    }
    toast(`Order #${id} marked ${status}`, "success");
    await Promise.all([loadOrders(), loadInventory()]);
  });

  // Live new-order alerts while this page is open
  function listenForOrders() {
    if (channel) db.removeChannel(channel);
    channel = db
      .channel("new-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const before = orders.find((x) => x.id === payload.new?.id);
        // Alert for new cash orders, and for card orders once they're paid.
        const isNewOrder =
          (payload.eventType === "INSERT" && payload.new.payment_method !== "card") ||
          (payload.eventType === "UPDATE" && payload.new.payment_status === "paid" && before?.payment_status !== "paid");
        // Wait a moment so the order's items are saved before we fetch it.
        setTimeout(async () => {
          await Promise.all([loadOrders(), loadInventory()]);
          if (!isNewOrder) return;
          const o = orders.find((x) => x.id === payload.new.id);
          const msg = `New order #${payload.new.id}` + (o ? ` · ${money(o.total)} from ${o.customer_name}` : "");
          toast("🛍️ " + msg, "success");
          beep();
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("Scent Drip", { body: msg });
          }
        }, 1500);
      })
      .subscribe();
  }

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18].forEach((t) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.2, ctx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.15);
        o.connect(g).connect(ctx.destination);
        o.start(ctx.currentTime + t);
        o.stop(ctx.currentTime + t + 0.15);
      });
    } catch (e) {}
  }

  $("enable-alerts").onclick = async () => {
    if (!("Notification" in window)) return toast("This browser doesn't support pop-up alerts.", "error");
    const p = await Notification.requestPermission();
    toast(p === "granted" ? "Pop-up alerts enabled ✅ (keep this tab open)" : "Alerts were blocked by the browser.", p === "granted" ? "success" : "error");
  };

  // =================== Inventory ===================
  async function loadInventory() {
    const { data, error } = await db
      .from("perfumes")
      .select("*, perfume_costs(cost_price, supplier)")
      .order("created_at", { ascending: false });
    if (error) return toast("Couldn't load inventory: " + error.message, "error");
    perfumes = data.map((p) => {
      const c = Array.isArray(p.perfume_costs) ? p.perfume_costs[0] : p.perfume_costs;
      return { ...p, cost_price: c ? Number(c.cost_price) : 0, supplier: c ? c.supplier : "" };
    });
    renderInventory();
  }

  function renderInventory() {
    const units = perfumes.reduce((s, p) => s + p.stock, 0);
    const costValue = perfumes.reduce((s, p) => s + p.cost_price * p.stock, 0);
    const sellValue = perfumes.reduce((s, p) => s + p.selling_price * p.stock, 0);
    const low = perfumes.filter((p) => p.stock <= 3).length;

    $("inventory-stats").innerHTML = [
      ["Perfumes", perfumes.length],
      ["Bottles in stock", units],
      ["Stock cost (what you paid)", money(costValue)],
      ["Stock selling value", money(sellValue)],
      ["Potential profit", money(sellValue - costValue), "pos"],
      ["Low / out of stock", low],
    ]
      .map(([l, v, c]) => `<div class="stat"><div class="label">${l}</div><div class="value ${c || ""}">${v}</div></div>`)
      .join("");

    const q = $("inv-search").value.trim().toLowerCase();
    const list = perfumes.filter((p) => !q || [p.name, p.brand, p.category, p.supplier].some((s) => (s || "").toLowerCase().includes(q)));

    if (!list.length) {
      $("inventory-body").innerHTML = `<tr><td colspan="9" class="empty">${perfumes.length ? "No matches." : "No perfumes yet — click “Add perfume” to add your first one."}</td></tr>`;
      return;
    }

    $("inventory-body").innerHTML = list
      .map((p) => {
        const profit = p.selling_price - p.cost_price;
        const stockCls = p.stock === 0 ? "stock-out" : p.stock <= 3 ? "stock-low" : "";
        return `
        <tr class="${p.is_active ? "" : "inactive"}">
          <td>${p.image_url ? `<img class="thumb" src="${esc(p.image_url)}" alt="" />` : `<div class="thumb"><img src="images/logo-mark-dark.png" alt="" /></div>`}</td>
          <td><strong>${esc(p.name)}</strong><br /><span class="card-meta">${[p.brand, p.size_ml ? p.size_ml + " ml" : "", p.category].filter(Boolean).map(esc).join(" · ")}</span></td>
          <td class="num ${stockCls}">${p.stock}</td>
          <td class="num">${money(p.cost_price)}</td>
          <td class="num">${money(p.selling_price)}</td>
          <td class="num ${profit >= 0 ? "pos" : "neg"}">${money(profit)}${p.selling_price > 0 ? ` <small>(${Math.round((profit / p.selling_price) * 100)}%)</small>` : ""}</td>
          <td class="num">${money(p.cost_price * p.stock)}</td>
          <td><input type="checkbox" data-toggle="${p.id}" ${p.is_active ? "checked" : ""} aria-label="Visible in shop" /></td>
          <td><div class="actions">
            <button class="btn outline small" data-edit="${p.id}">Edit</button>
            <button class="btn danger small" data-delete="${p.id}">Delete</button>
          </div></td>
        </tr>`;
      })
      .join("");
  }

  $("inv-search").addEventListener("input", renderInventory);

  $("inventory-body").addEventListener("click", async (e) => {
    const t = e.target.closest("[data-edit],[data-delete]");
    if (!t) return;
    if (t.dataset.edit) return openPerfumeForm(perfumes.find((p) => p.id === t.dataset.edit));
    const p = perfumes.find((x) => x.id === t.dataset.delete);
    if (!confirm(`Delete "${p.name}" permanently?\n\nTip: untick "Visible" instead if you just want to hide it for now.`)) return;
    const { error } = await db.from("perfumes").delete().eq("id", p.id);
    if (error) return toast("Couldn't delete: " + error.message, "error");
    removeImage(p.image_url);
    toast(`"${p.name}" deleted`, "success");
    loadInventory();
  });

  $("inventory-body").addEventListener("change", async (e) => {
    const t = e.target.closest("[data-toggle]");
    if (!t) return;
    const { error } = await db.from("perfumes").update({ is_active: t.checked, updated_at: new Date().toISOString() }).eq("id", t.dataset.toggle);
    if (error) {
      t.checked = !t.checked;
      return toast("Couldn't update: " + error.message, "error");
    }
    toast(t.checked ? "Now visible in the shop" : "Hidden from the shop", "success");
    loadInventory();
  });

  // ----- Add / edit form -----
  const form = $("perfume-form");

  function openPerfumeForm(p) {
    form.reset();
    $("perfume-modal-title").textContent = p ? "Edit perfume" : "Add perfume";
    const v = p || { is_active: true };
    for (const k of ["id", "name", "brand", "category", "size_ml", "cost_price", "selling_price", "stock", "supplier", "description", "image_url"]) {
      form.elements[k].value = v[k] ?? "";
    }
    form.elements.is_active.checked = !!v.is_active;
    const prev = $("img-preview");
    prev.src = v.image_url || "";
    prev.classList.toggle("hidden", !v.image_url);
    $("perfume-modal").classList.remove("hidden");
    $("overlay").classList.remove("hidden");
    form.elements.name.focus();
  }

  function closeModal() {
    $("perfume-modal").classList.add("hidden");
    $("overlay").classList.add("hidden");
  }

  $("add-perfume").onclick = () => openPerfumeForm(null);
  $("close-modal").onclick = closeModal;
  $("overlay").onclick = closeModal;
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeModal());

  form.elements.image.addEventListener("change", () => {
    const file = form.elements.image.files[0];
    if (!file) return;
    const prev = $("img-preview");
    prev.src = URL.createObjectURL(file);
    prev.classList.remove("hidden");
  });

  async function uploadImage(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("Photo is too large (max 5 MB).");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await db.storage.from(BUCKET).upload(path, file, { contentType: file.type });
    if (error) throw error;
    return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  function removeImage(url) {
    const marker = `/${BUCKET}/`;
    if (!url || !url.includes(marker)) return;
    db.storage.from(BUCKET).remove([url.split(marker)[1]]).catch(() => {});
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const f = form.elements;
    const btn = $("save-perfume");
    btn.disabled = true;
    btn.textContent = "Saving…";

    try {
      const oldUrl = f.image_url.value;
      let imageUrl = oldUrl || null;
      if (f.image.files[0]) imageUrl = await uploadImage(f.image.files[0]);

      const row = {
        name: f.name.value.trim(),
        brand: f.brand.value.trim() || null,
        category: f.category.value.trim() || null,
        size_ml: f.size_ml.value ? parseInt(f.size_ml.value, 10) : null,
        selling_price: Number(f.selling_price.value),
        stock: parseInt(f.stock.value, 10),
        description: f.description.value.trim() || null,
        image_url: imageUrl,
        is_active: f.is_active.checked,
        updated_at: new Date().toISOString(),
      };

      let id = f.id.value;
      if (id) {
        const { error } = await db.from("perfumes").update(row).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await db.from("perfumes").insert(row).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      const { error: costErr } = await db.from("perfume_costs").upsert({
        perfume_id: id,
        cost_price: Number(f.cost_price.value),
        supplier: f.supplier.value.trim() || null,
        updated_at: new Date().toISOString(),
      });
      if (costErr) throw costErr;

      if (imageUrl !== oldUrl) removeImage(oldUrl);
      toast(`"${row.name}" saved`, "success");
      closeModal();
      loadInventory();
    } catch (err) {
      toast("Couldn't save: " + (err.message || err), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "Save perfume";
    }
  });

  start();
})();
