// "Talk with SD" — a guided chat that finds perfumes by top, heart and base notes.
(function () {
  const { esc, money, cfg } = window.SD;
  const { CHOICES, CATALOG } = window.SD_NOTES;
  const $ = (id) => document.getElementById(id);

  const STEPS = [
    { key: "top", title: "top notes", hint: "The first notes you smell, bright and fresh" },
    { key: "middle", title: "heart notes", hint: "The heart of the perfume, once the top notes settle" },
    { key: "base", title: "base notes", hint: "The deep notes that linger on your skin for hours" },
  ];

  // Close relatives count as the same note when matching.
  const ALIASES = {
    ambergris: "amber", labdanum: "amber", amberwood: "amber",
    myrrh: "incense", opoponax: "incense",
    "peru balsam": "benzoin", styrax: "benzoin",
    birch: "leather", agarwood: "oud", "tonka": "tonka bean", chocolate: "cocoa",
  };
  const key = (n) => {
    const k = String(n || "").trim().toLowerCase();
    return ALIASES[k] || k;
  };

  let step = 0;
  let picks = { top: new Set(), middle: new Set(), base: new Set() };
  let started = false;

  // ---------- Matching ----------
  // Same layer = full point. Same note in another layer = 0.6 of a point.
  function score(perfume) {
    const layers = { top: perfume.top || [], middle: perfume.middle || [], base: perfume.base || [] };
    const sets = Object.fromEntries(Object.entries(layers).map(([l, notes]) => [l, new Set(notes.map(key))]));
    let total = 0, points = 0;
    const matched = new Set();
    for (const layer of ["top", "middle", "base"]) {
      for (const note of picks[layer]) {
        total += 1;
        const k = key(note);
        if (sets[layer].has(k)) { points += 1; matched.add(k); }
        else if (sets.top.has(k) || sets.middle.has(k) || sets.base.has(k)) { points += 0.6; matched.add(k); }
      }
    }
    return { pct: total ? Math.round((points / total) * 100) : 0, matched };
  }

  function shopPerfumes() {
    const list = (window.SDShop && window.SDShop.getPerfumes()) || [];
    return list
      .filter((p) => (p.top_notes || []).length + (p.middle_notes || []).length + (p.base_notes || []).length > 0)
      .map((p) => ({ name: p.name, brand: p.brand || "", top: p.top_notes || [], middle: p.middle_notes || [], base: p.base_notes || [], shop: p }));
  }

  function findMatches() {
    const shopList = shopPerfumes();
    const shopNames = new Map(((window.SDShop && window.SDShop.getPerfumes()) || []).map((p) => [p.name.trim().toLowerCase(), p]));
    const rank = (list) =>
      list
        .map((p) => ({ ...p, ...score(p) }))
        .filter((p) => p.pct > 0)
        .sort((a, b) => b.pct - a.pct || b.matched.size - a.matched.size);

    // Only suggest our own perfumes when they're a reasonable match.
    const inShop = rank(shopList).filter((p) => p.pct >= 34).slice(0, 3);
    const inShopNames = new Set(inShop.map((p) => p.name.trim().toLowerCase()));
    const catalog = rank(CATALOG)
      .filter((p) => !inShopNames.has(p.name.trim().toLowerCase()))
      .slice(0, 3)
      .map((p) => ({ ...p, shop: p.shop || shopNames.get(p.name.trim().toLowerCase()) }));
    return { inShop, catalog };
  }

  // ---------- Chat UI ----------
  const log = () => $("sd-chat-log");

  function scrollDown() {
    const el = log();
    el.scrollTop = el.scrollHeight;
  }

  function addMessage(html, who = "bot") {
    const div = document.createElement("div");
    div.className = `sd-msg ${who}`;
    div.innerHTML = html;
    log().appendChild(div);
    scrollDown();
    return div;
  }

  // SD "types" for a moment before each message.
  function botSay(html, delay = 650) {
    return new Promise((resolve) => {
      const typing = addMessage(`<span class="sd-typing"><i></i><i></i><i></i></span>`, "bot typing");
      setTimeout(() => {
        typing.remove();
        resolve(addMessage(html, "bot"));
      }, delay);
    });
  }

  function setInput(html) {
    $("sd-chat-input").innerHTML = html;
  }

  function renderChoices() {
    const s = STEPS[step];
    const chosen = picks[s.key];
    setInput(`
      <div class="sd-chips" role="group" aria-label="${s.title}">
        ${CHOICES[s.key].map((n) => `<button type="button" class="sd-chip ${chosen.has(n) ? "on" : ""}" data-note="${esc(n)}" aria-pressed="${chosen.has(n)}">${esc(n)}</button>`).join("")}
      </div>
      <div class="sd-actions">
        <span class="sd-step">Step ${step + 1} of 3</span>
        ${step > 0 ? `<button type="button" class="sd-link" data-act="back">Back</button>` : ""}
        <button type="button" class="btn small" data-act="next">${chosen.size ? (step === 2 ? "Find my match" : "Next") : "Skip"}</button>
      </div>`);
  }

  async function askStep() {
    const s = STEPS[step];
    setInput("");
    await botSay(`Which <strong>${s.title}</strong> do you love? <span class="sd-sub">${s.hint}. Pick as many as you like.</span>`);
    renderChoices();
  }

  async function next() {
    const s = STEPS[step];
    const chosen = [...picks[s.key]];
    addMessage(chosen.length ? esc(chosen.join(", ")) : `<em>No ${s.title} preference</em>`, "user");
    if (step < 2) {
      step += 1;
      return askStep();
    }
    const total = picks.top.size + picks.middle.size + picks.base.size;
    if (!total) {
      step = 0;
      await botSay("Pick at least one note so I can find your match. Let's start again with the top notes.");
      return askStep();
    }
    return showResults();
  }

  function notesLine(label, notes, matched) {
    if (!notes.length) return "";
    return `<p><span>${label}</span>${notes.map((n) => (matched.has(key(n)) ? `<b>${esc(n)}</b>` : esc(n))).join(", ")}</p>`;
  }

  function askLink(p) {
    const text = `Hi Scent Drip! Talk with SD matched me with ${p.name} by ${p.brand}. Can you get it for me?`;
    if (cfg.WHATSAPP_NUMBER) return `https://wa.me/${String(cfg.WHATSAPP_NUMBER).replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
    return "https://www.instagram.com/scent_drip/";
  }

  function resultCard(p) {
    const inStock = p.shop && p.shop.stock > 0;
    let action;
    if (p.shop && inStock) {
      action = `<span class="sd-tag">In our shop · ${money(p.shop.selling_price)}</span>
        <div class="sd-card-btns">
          <button type="button" class="btn small" data-sd-add="${p.shop.id}">Add to bag</button>
          <button type="button" class="sd-link" data-sd-view="${p.shop.id}">View</button>
        </div>`;
    } else if (p.shop) {
      action = `<span class="sd-tag muted">In our shop · sold out</span>
        <div class="sd-card-btns"><a class="btn small outline" href="${askLink(p)}" target="_blank" rel="noopener">Ask about restock</a></div>`;
    } else {
      action = `<span class="sd-tag muted">Not in our shop yet</span>
        <div class="sd-card-btns"><a class="btn small outline" href="${askLink(p)}" target="_blank" rel="noopener">Ask us to get it</a></div>`;
    }
    return `
      <div class="sd-card">
        <div class="sd-card-head">
          <div><small>${esc(p.brand)}</small><strong>${esc(p.name)}</strong></div>
          <span class="sd-pct" style="--p:${p.pct}">${p.pct}%</span>
        </div>
        <div class="sd-notes">
          ${notesLine("Top", p.top, p.matched)}
          ${notesLine("Heart", p.middle, p.matched)}
          ${notesLine("Base", p.base, p.matched)}
        </div>
        ${action}
      </div>`;
  }

  async function showResults() {
    setInput("");
    await botSay("Lovely choices. Let me find your scent…", 500);
    const { inShop, catalog } = findMatches();
    if (!inShop.length && !catalog.length) {
      await botSay("I couldn't find a perfume with those notes. Try a few different ones?");
    } else {
      if (inShop.length) {
        await botSay(`<p class="sd-res-title">From our shop</p>${inShop.map(resultCard).join("")}`, 700);
      }
      if (catalog.length) {
        await botSay(
          `<p class="sd-res-title">${inShop.length ? "More perfect matches" : "Your perfect matches"}</p>${catalog.map(resultCard).join("")}
           <p class="sd-sub">Matching notes are in <b>bold</b>. Notes are taken from each perfume's published note list.</p>`,
          inShop.length ? 500 : 900
        );
      }
    }
    setInput(`<div class="sd-actions end"><button type="button" class="btn small outline" data-act="restart">Start over</button></div>`);
  }

  async function start() {
    step = 0;
    picks = { top: new Set(), middle: new Set(), base: new Set() };
    log().innerHTML = "";
    await botSay(`Hi, I'm <strong>SD</strong> ✦ I'll help you find a perfume you'll love, based on the notes you enjoy.`, 400);
    await askStep();
  }

  function open() {
    $("sd-chat").classList.remove("hidden");
    $("sd-chat-open").classList.add("hidden");
    document.body.classList.add("sd-chat-open");
    if (!started) {
      started = true;
      start();
    }
  }

  function close() {
    $("sd-chat").classList.add("hidden");
    $("sd-chat-open").classList.remove("hidden");
    document.body.classList.remove("sd-chat-open");
  }

  // ---------- Events ----------
  $("sd-chat-open").addEventListener("click", open);
  $("sd-chat-close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => e.key === "Escape" && !$("sd-chat").classList.contains("hidden") && close());

  $("sd-chat").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-note]");
    if (chip) {
      const set = picks[STEPS[step].key];
      const n = chip.dataset.note;
      set.has(n) ? set.delete(n) : set.add(n);
      return renderChoices();
    }
    const act = e.target.closest("[data-act]");
    if (act) {
      if (act.dataset.act === "next") return next();
      if (act.dataset.act === "back") {
        addMessage("Back", "user");
        step -= 1;
        return askStep();
      }
      if (act.dataset.act === "restart") return start();
    }
    const add = e.target.closest("[data-sd-add]");
    if (add && window.SDShop) return window.SDShop.addToCart(add.dataset.sdAdd);
    const view = e.target.closest("[data-sd-view]");
    if (view && window.SDShop) {
      close();
      return window.SDShop.openProduct(view.dataset.sdView);
    }
  });

  window.SDChat = { open, close };
})();
