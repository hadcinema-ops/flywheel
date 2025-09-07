// frontend/app.js (sticky reconnect build)
(() => {
  const API_BASE = "/.netlify/functions/flywheel";
  const DEV_WALLET = "CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm";

  const $ = (id) => document.getElementById(id);
  const short = (k) => (k ? k.slice(0, 4) + "…" + k.slice(-4) : "");

  let connectedPubkey = null;

  function getPhantomProvider() {
    if (window?.solana?.isPhantom) return window.solana;
    if (window?.phantom?.solana?.isPhantom) return window.phantom.solana;
    return null;
  }

  function setBtnLabel(addr) {
    const btn = $("#connectBtn");
    if (!btn) return;
    btn.textContent = addr ? short(addr) : "Connect Wallet";
  }

  function showDevControls(show) {
    const panel = $("#dev-controls");
    if (!panel) return;
    panel.classList.toggle("hidden", !show);
    const note = $("#dev-note");
    if (note) note.textContent = show ? `Connected as DEV: ${short(connectedPubkey)}` : "";
  }

  function syncDevControls() {
    const isDev = connectedPubkey && connectedPubkey === DEV_WALLET;
    showDevControls(!!isDev);
  }

  async function safeConnect({ onlyIfTrusted = false } = {}) {
    const provider = getPhantomProvider();
    if (!provider) {
      alert("Phantom not detected. Install Phantom to continue.");
      try { window.open("https://phantom.app/", "_blank"); } catch {}
      return null;
    }
    try {
      const resp = await provider.connect({ onlyIfTrusted });
      const pk =
        resp?.publicKey?.toString?.() ||
        provider.publicKey?.toString?.() ||
        null;
      if (pk) {
        connectedPubkey = pk;
        setBtnLabel(pk);
        syncDevControls();
        return pk;
      }
    } catch (e) {
      // If onlyIfTrusted, ignore; if user-initiated, show
      if (!onlyIfTrusted) alert("Wallet connection failed or cancelled.");
      console.warn("[wallet] connect error:", e);
    }
    return null;
  }

  async function connectWallet(ev) {
    try { ev?.preventDefault(); ev?.stopPropagation(); } catch {}
    await safeConnect({ onlyIfTrusted: false });
  }

  // Expose helpers for console debugging
  window.__connectPhantom = connectWallet;
  window.__phantomProvider = () => getPhantomProvider();

  function bindUI() {
    const btn = $("#connectBtn");
    if (btn) {
      // Remove existing events by cloning (prevents duplicate bindings)
      const clone = btn.cloneNode(true);
      btn.parentNode.replaceChild(clone, btn);
      ["click", "pointerup", "touchend"].forEach((t) =>
        clone.addEventListener(t, connectWallet, { passive: false })
      );
      clone.setAttribute("onclick", "return window.__connectPhantom && window.__connectPhantom(event)");
      clone.id = "connectBtn"; // keep same id
    }

    const s = $("#btn-start"), p = $("#btn-stop"), t = $("#btn-test");
    if (s) s.addEventListener("click", () => call("start"));
    if (p) p.addEventListener("click", () => call("stop"));
    if (t) t.addEventListener("click", () => call("test"));
  }

  async function refreshStats() {
    try {
      const r = await fetch(`${API_BASE}?op=stats`);
      const data = await r.json();
      $("#stat-sol-claimed") && ($("#stat-sol-claimed").textContent = data.totalSOLClaimed?.toFixed?.(4) ?? "0");
      $("#stat-tokens-bought") && ($("#stat-tokens-bought").textContent = data.totalTokensBought ?? "0");
      $("#stat-tokens-burned") && ($("#stat-tokens-burned").textContent = data.totalTokensBurned ?? "0");
      $("#stat-last-run") && ($("#stat-last-run").textContent = data.lastRun ?? "—");
      renderFeed(data.activity || []);
    } catch (e) {
      console.warn("stats error:", e);
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
    // Ensure connected
    if (!connectedPubkey) await safeConnect({ onlyIfTrusted: false });
    if (connectedPubkey !== DEV_WALLET) {
      alert("Only the DEV wallet can do this.");
      return;
    }
    const dry = $("#chk-dryrun")?.checked;
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
      alert(`Action failed: ${op}`);
      console.error(op, e);
    }
  }

  function wireProviderEvents(provider) {
    if (!provider || provider._rsh_wired) return;
    provider._rsh_wired = true;

    provider.on?.("connect", (pubKey) => {
      const pk = pubKey?.toString?.() || provider.publicKey?.toString?.() || null;
      if (pk) {
        connectedPubkey = pk;
        setBtnLabel(pk);
        syncDevControls();
      }
    });

    provider.on?.("disconnect", () => {
      connectedPubkey = null;
      setBtnLabel(null);
      syncDevControls();
    });

    provider.on?.("accountChanged", (pubKey) => {
      const pk = pubKey?.toString?.() || provider.publicKey?.toString?.() || null;
      connectedPubkey = pk;
      setBtnLabel(pk);
      syncDevControls();
    });
  }

  async function init() {
    bindUI();
    const provider = getPhantomProvider();
    if (provider) {
      wireProviderEvents(provider);
      // Rehydrate session silently if already trusted
      await safeConnect({ onlyIfTrusted: true });
    }
    refreshStats();
    setInterval(refreshStats, 15000);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
