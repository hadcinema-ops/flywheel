
// frontend/app.js
(() => {
  const API_BASE = "/.netlify/functions/flywheel";
  const DEV_WALLET = "CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm";

  const $ = (id) => document.getElementById(id);
  const short = (k) => k.slice(0, 4) + "…" + k.slice(-4);

  let connectedPubkey = null;

  function getPhantomProvider() {
    if (window?.solana?.isPhantom) return window.solana;
    if (window?.phantom?.solana?.isPhantom) return window.phantom.solana;
    return null;
  }

  async function connectWallet() {
    const provider = getPhantomProvider();
    if (!provider) {
      alert("Phantom wallet not detected. Install it to continue.");
      window.open("https://phantom.app/", "_blank");
      console.warn("[wallet] Phantom provider not found on window.");
      return;
    }
    try {
      const resp = await provider.connect({ onlyIfTrusted: false });
      const pubkey =
        (resp?.publicKey?.toString?.()) || provider.publicKey?.toString?.();
      if (!pubkey) throw new Error("No publicKey from Phantom connect()");
      connectedPubkey = pubkey;
      $("#connectBtn").textContent = short(connectedPubkey);
      toggleDevControls();
      console.log("[wallet] connected", connectedPubkey);
    } catch (e) {
      console.error("Phantom connect failed:", e);
      alert(
        "Wallet connection was cancelled or failed. Check the browser popup and try again."
      );
    }
  }

  function toggleDevControls() {
    const panel = $("#dev-controls");
    if (connectedPubkey && connectedPubkey === DEV_WALLET) {
      panel.classList.remove("hidden");
      $("#dev-note").textContent = `Connected as DEV: ${short(
        connectedPubkey
      )}`;
    } else {
      panel.classList.add("hidden");
    }
  }

  async function refreshStats() {
    try {
      const r = await fetch(`${API_BASE}?op=stats`);
      if (!r.ok) throw new Error(`stats http ${r.status}`);
      const data = await r.json();
      $("#stat-sol-claimed").textContent =
        data.totalSOLClaimed?.toFixed?.(4) ?? "0";
      $("#stat-tokens-bought").textContent =
        data.totalTokensBought ?? "0";
      $("#stat-tokens-burned").textContent =
        data.totalTokensBurned ?? "0";
      $("#stat-last-run").textContent = data.lastRun ?? "—";
      renderFeed(data.activity || []);
    } catch (e) {
      console.error("stats fetch error:", e);
    }
  }

  function renderFeed(items) {
    const ul = $("#activity");
    ul.innerHTML = "";
    items.slice(0, 50).forEach((it) => {
      const li = document.createElement("li");
      li.innerHTML = `<b>${it.title}</b>
        <div class="muted small">${it.desc || ""}</div>
        ${
          it.tx
            ? `<div class="small"><a href="https://solscan.io/tx/${it.tx}" target="_blank" rel="noreferrer">View on Solscan</a></div>`
            : ""
        }`;
      ul.appendChild(li);
    });
  }

  async function call(op) {
    if (!connectedPubkey) await connectWallet();
    if (connectedPubkey !== DEV_WALLET)
      return alert("Only the DEV wallet can do this.");
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
      console.error(`${op} error:`, e);
      alert(`Action failed: ${op}`);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    $("#connectBtn")?.addEventListener("click", connectWallet);
    $("#btn-start")?.addEventListener("click", () => call("start"));
    $("#btn-stop")?.addEventListener("click", () => call("stop"));
    $("#btn-test")?.addEventListener("click", () => call("test"));
    refreshStats();
    setInterval(refreshStats, 15000);
  });
})();
