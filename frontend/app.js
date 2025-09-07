// frontend/app.js (diagnostic build)
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
    console.log("[wallet] provider detected:", !!prov);
    return prov;
  }

  async function connectWallet() {
    console.log("[wallet] connectWallet() called");
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
      console.log("[wallet] connected:", connectedPubkey);
      const btn = $("#connectBtn");
      if (btn) btn.textContent = short(connectedPubkey);
      toggleDevControls();
    } catch (e) {
      console.error("Phantom connect failed:", e);
      alert("Wallet connection was cancelled or failed. Check the popup and try again.");
    }
  }
  // Expose for inline fallback
  window.__connectPhantom = connectWallet;

  function toggleDevControls() {
    const panel = $("#dev-controls");
    if (!panel) { console.warn("[ui] dev-controls panel not found"); return; }
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
      if (!r.ok) throw new Error(`stats http ${r.status}`);
      const data = await r.json();
      const sc = $("#stat-sol-claimed"); if (sc) sc.textContent = data.totalSOLClaimed?.toFixed?.(4) ?? "0";
      const tb = $("#stat-tokens-bought"); if (tb) tb.textContent = data.totalTokensBought ?? "0";
      const br = $("#stat-tokens-burned"); if (br) br.textContent = data.totalTokensBurned ?? "0";
      const lr = $("#stat-last-run"); if (lr) lr.textContent = data.lastRun ?? "—";
      renderFeed(data.activity || []);
    } catch (e) {
      console.error("stats fetch error:", e);
    }
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
    } catch (e) {
      console.error(`${op} error:`, e);
      alert(`Action failed: ${op}`);
    }
  }

  function bindUI() {
    console.log("[ui] binding UI");
    const connectBtn = $("#connectBtn");
    if (connectBtn) {
      // Primary binding
      connectBtn.addEventListener("click", connectWallet);
      // Fallback in case something overrides listeners
      connectBtn.setAttribute("onclick", "window.__connectPhantom && window.__connectPhantom()");
    } else {
      console.warn("[ui] #connectBtn not found in DOM");
    }

    const s = $("#btn-start"), p = $("#btn-stop"), t = $("#btn-test");
    if (s) s.addEventListener("click", () => call("start"));
    if (p) p.addEventListener("click", () => call("stop"));
    if (t) t.addEventListener("click", () => call("test"));

    // Global safety net: if someone clicks an element with data-connect attribute
    document.addEventListener("click", (ev) => {
      const trg = ev.target.closest?.("[data-connect]");
      if (trg) { connectWallet(); }
    });
  }

  window.addEventListener("DOMContentLoaded", () => {
    console.log("[app] DOMContentLoaded");
    bindUI();
    refreshStats();
    setInterval(refreshStats, 15000);
  });
})();
