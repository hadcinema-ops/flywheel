const API_BASE = "/.netlify/functions/flywheel"; // HTTP function
const DEV_WALLET = "CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm";

const $ = (id)=>document.getElementById(id);

let connectedPubkey = null;

async function connectWallet() {
  if (!window.phantomDetected()) {
    alert("Install Phantom wallet to continue.");
    window.open("https://phantom.app/", "_blank");
    return;
  }
  const provider = window.solana;
  const resp = await provider.connect({ onlyIfTrusted: false });
  connectedPubkey = resp.publicKey.toString();
  $("#connectBtn").textContent = short(connectedPubkey);
  toggleDevControls();
}

function short(k){ return k.slice(0,4)+"…"+k.slice(-4); }

function toggleDevControls() {
  const panel = $("#dev-controls");
  if (connectedPubkey && connectedPubkey === DEV_WALLET) {
    panel.classList.remove("hidden");
    $("#dev-note").textContent = `Connected as DEV: ${short(connectedPubkey)}`;
  } else {
    panel.classList.add("hidden");
  }
}

$("#connectBtn").addEventListener("click", connectWallet);

async function refreshStats() {
  try {
    const r = await fetch(`${API_BASE}?op=stats`);
    const data = await r.json();
    $("#stat-sol-claimed").textContent = data.totalSOLClaimed?.toFixed(4) ?? "0";
    $("#stat-tokens-bought").textContent = data.totalTokensBought ?? "0";
    $("#stat-tokens-burned").textContent = data.totalTokensBurned ?? "0";
    $("#stat-last-run").textContent = data.lastRun ?? "—";
    renderFeed(data.activity || []);
  } catch(e){ console.error(e); }
}

function renderFeed(items){
  const ul = $("#activity");
  ul.innerHTML = "";
  items.slice(0, 50).forEach(it=>{
    const li = document.createElement("li");
    li.innerHTML = `<b>${it.title}</b><div class="muted small">${it.desc || ""}</div>${it.tx ? `<div class="small"><a href="https://solscan.io/tx/${it.tx}" target="_blank">View on Solscan</a></div>`:""}`;
    ul.appendChild(li);
  });
}

async function call(op) {
  if (!connectedPubkey) await connectWallet();
  if (connectedPubkey !== DEV_WALLET) return alert("Only the DEV wallet can do this.");
  const dry = $("#chk-dryrun").checked;
  const r = await fetch(`${API_BASE}?op=${op}&dry=${dry?"1":"0"}`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ from: connectedPubkey }) });
  const data = await r.json();
  await refreshStats();
  alert(data?.message || "OK");
}

$("#btn-start").onclick = ()=>call("start");
$("#btn-stop").onclick = ()=>call("stop");
$("#btn-test").onclick = ()=>call("test");

refreshStats();
setInterval(refreshStats, 15000);
