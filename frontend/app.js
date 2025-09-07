// frontend/app.js (hammer mode)
(() => {
  const API_BASE = "/.netlify/functions/flywheel";
  const DEV_WALLET = "CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm";

  const $ = (id) => document.getElementById(id);
  const short = (k) => k.slice(0, 4) + "…" + k.slice(-4);

  let connectedPubkey = null;

  function getPhantomProvider() {
    const prov =
      (window && window.solana && window.solana.isPhantom && window.solana) ||
      (window && window.phantom && window.phantom.solana && window.phantom.solana.isPhantom && window.phantom.solana) ||
      null;
    return prov;
  }

  async function connectWallet(ev) {
    try { ev && ev.preventDefault && ev.preventDefault(); } catch {}
    try { ev && ev.stopPropagation && ev.stopPropagation(); } catch {}
    const provider = getPhantomProvider();
    if (!provider) {
      alert("Phantom wallet not detected. Install it to continue.");
      try { window.open("https://phantom.app/", "_blank"); } catch {}
      return;
    }
    try {
      const resp = await provider.connect({ onlyIfTrusted: false });
      const pubkey =
        (resp && resp.publicKey && resp.publicKey.toString && resp.publicKey.toString()) ||
        (provider.publicKey && provider.publicKey.toString && provider.publicKey.toString());
      if (!pubkey) throw new Error("No publicKey from Phantom connect()");
      connectedPubkey = pubkey;
      const btn = $("#connectBtn");
      if (btn) btn.textContent = short(connectedPubkey);
      toggleDevControls();
    } catch (e) {
      alert("Wallet connection was cancelled or failed. Check the popup and try again.");
    }
  }
  window.__connectPhantom = connectWallet;

  function toggleDevControls() {
    const panel = $("#dev-controls");
    if (!panel) return;
    if (connectedPubkey && connectedPubkey === DEV_WALLET) {
      panel.classList.remove("hidden");
      const note = $("#dev-note");
      if (note) note.textContent = `Connected as DEV: ${short(connectedPubkey)}`;
    } else {
      panel.classList.add("hidden");
    }
  }

  async function refreshStats() {
    try {
      const r = await fetch(`${API_BASE}?op=stats`);
      const data = await r.json();
      const sc = $("#stat-sol-claimed"); if (sc) sc.textContent = data.totalSOLClaimed?.toFixed?.(4) ?? "0";
      const tb = $("#stat-tokens-bought"); if (tb) tb.textContent = data.totalTokensBought ?? "0";
      const br = $("#stat-tokens-burned"); if (br) br.textContent = data.totalTokensBurned ?? "0";
      const lr = $("#stat-last-run"); if (lr) lr.textContent = data.lastRun ?? "—";
      renderFeed(data.activity || []);
    } catch {}
  }

  function renderFeed(items) {
    const ul = $("#activity");
    if (!ul) return;
    ul.innerHTML = "";
    items.slice(0, 50).forEach((it) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${it.title}</b>
        <div class="muted small">${it.desc || ""}</div>
        ${it.tx ? `<div class="small"><a href="https://solscan.io/tx/${it.tx}" target="_blank" rel="noreferrer">View on Solscan</a></div>` : ""}`;
      ul.appendChild(li);
    });
  }

  async function call(op) {
    if (!connectedPubkey) await connectWallet();
    if (connectedPubkey !== DEV_WALLET) { alert("Only the DEV wallet can do this."); return; }
    const dry = $("#chk-dryrun") && $("#chk-dryrun").checked;
    try {
      const r = await fetch(`${API_BASE}?op=${op}&dry=${dry ? "1" : "0"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: connectedPubkey }),
      });
      const data = await r.json();
      await refreshStats();
      alert(data?.message || "OK");
    } catch {
      alert(`Action failed: ${op}`);
    }
  }

  function bindConnect(btn) {
    if (!btn) return;
    // Remove existing listeners by cloning (in case a framework attached passive handlers)
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
    // Multiple event types to maximize chance of user-gesture recognition
    ["click", "pointerup", "touchend", "mousedown"].forEach((type) => {
      clone.addEventListener(type, connectWallet, { passive: false, capture: true });
    });
    // Attribute fallback (works when JS listeners get nuked by other code)
    clone.setAttribute("onclick", "return window.__connectPhantom && window.__connectPhantom(event)");
    // Accessibility
    clone.setAttribute("role", "button");
    clone.setAttribute("tabindex", "0");
    clone.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") connectWallet(e);
    });
  }

  function bindUI() {
    bindConnect($("#connectBtn"));
    const s = $("#btn-start"), p = $("#btn-stop"), t = $("#btn-test");
    if (s) s.addEventListener("click", () => call("start"), { capture: true });
    if (p) p.addEventListener("click", () => call("stop"), { capture: true });
    if (t) t.addEventListener("click", () => call("test"), { capture: true });

    // Event delegation as global fallback
    document.addEventListener("click", (ev) => {
      const trg = ev.target && (ev.target.id === "connectBtn" || ev.target.closest?.("#connectBtn"));
      if (trg) connectWallet(ev);
    }, { capture: true });
  }

  // Re-bind if DOM changes (framework re-render, etc.)
  const mo = new MutationObserver(() => {
    const btn = $("#connectBtn");
    if (btn && !btn._bound) {
      btn._bound = true;
      bindUI();
    }
  });

  window.addEventListener("DOMContentLoaded", () => {
    bindUI();
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch {}
    refreshStats();
    setInterval(refreshStats, 15000);
  });
})();
