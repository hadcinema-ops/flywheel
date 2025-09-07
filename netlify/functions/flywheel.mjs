import { Connection, PublicKey } from "@solana/web3.js";

let STATS = { totalSOLClaimed: 0, totalTokensBought: "0", totalTokensBurned: "0", lastRun: undefined, activity: [] };

const ENV = {
  RPC_URL: process.env.RPC_URL,
  DEV_WALLET: process.env.DEV_WALLET,
  TOKEN_MINT: process.env.TOKEN_MINT,
  TX_FEE_BUFFER: parseFloat(process.env.TX_FEE_BUFFER || "0.01"),
  PUMPPORTAL_API: process.env.PUMPPORTAL_API || "https://pumpportal.fun/api/v2",
  JUPITER_API: process.env.JUPITER_API || "https://quote-api.jup.ag/v6",
  SLIPPAGE_BPS: parseInt(process.env.SLIPPAGE_BPS || "100"),
  MIN_BUY_SOL: parseFloat(process.env.MIN_BUY_SOL || "0.02"),
  MAX_BUY_SOL: parseFloat(process.env.MAX_BUY_SOL || "5"),
  BURN_METHOD: process.env.BURN_METHOD || "incinerator",
  DRY_RUN: process.env.DRY_RUN === "true"
};

function json(body, status=200){ return new Response(JSON.stringify(body, null, 2), { status, headers:{ "content-type":"application/json" } }); }

export default async (event, context) => {
  const url = new URL(event.rawUrl);
  const op = url.searchParams.get("op") || "stats";
  const dry = url.searchParams.get("dry") === "1" || ENV.DRY_RUN;

  if (op === "stats") return json(STATS);

  if (event.httpMethod !== "POST") return json({ error: "POST required" }, 405);

  const body = event.body ? JSON.parse(event.body) : {};
  if (!body?.from || body.from !== ENV.DEV_WALLET) return json({ error: "Unauthorized (dev wallet only)" }, 403);

  if (op === "start") {
    STATS.activity.unshift({ title: "Flywheel started", desc: new Date().toISOString() });
    return json({ message: "Started" });
  }
  if (op === "stop") {
    STATS.activity.unshift({ title: "Flywheel stopped", desc: new Date().toISOString() });
    return json({ message: "Stopped" });
  }
  if (op === "test") {
    const res = await runOnce(dry);
    return json({ message: "Test executed", detail: res });
  }
  return json({ error: "Unknown op" }, 400);
};

async function runOnce(dry){
  const connection = new Connection(ENV.RPC_URL, "confirmed");
  // 1) Claim creator fees (placeholder call — integrate PumpPortal per token settings)
  const claim = await claimCreatorFees(ENV.PUMPPORTAL_API, ENV.DEV_WALLET);
  const claimedSol = Number(claim?.amountSol || 0);
  if (claimedSol <= ENV.MIN_BUY_SOL) {
    STATS.activity.unshift({ title: "No significant fees to claim", desc: `claimed=${claimedSol}` });
    STATS.lastRun = new Date().toISOString();
    return { claimedSol, swapped:false, burned:false };
  }
  const spendable = Math.max(0, claimedSol - ENV.TX_FEE_BUFFER);
  const buySol = Math.min(spendable, ENV.MAX_BUY_SOL);
  if (buySol <= 0) {
    STATS.activity.unshift({ title: "All claimed used as buffer", desc: `claimed=${claimedSol}` });
    STATS.lastRun = new Date().toISOString();
    return { claimedSol, swapped:false, burned:false };
  }

  const swapBuild = await marketBuy(ENV.JUPITER_API, buySol, ENV.DEV_WALLET, ENV.TOKEN_MINT, ENV.SLIPPAGE_BPS);
  let swapSig = "";
  if (!dry) {
    // TODO: sign & submit swapBuild.swapTransaction with your wallet (client or server)
  }
  let burnSig = "";
  // TODO: perform SPL burn or send to incinerator destination

  STATS.totalSOLClaimed += claimedSol;
  STATS.totalTokensBought = (BigInt(STATS.totalTokensBought) + 0n).toString();
  STATS.totalTokensBurned = (BigInt(STATS.totalTokensBurned) + 0n).toString();
  STATS.activity.unshift({ title: "Cycle complete", desc: `claimed ${claimedSol.toFixed(4)} SOL → swapped ~${buySol.toFixed(4)} SOL → burned tokens`, tx: swapSig || undefined });
  STATS.lastRun = new Date().toISOString();
  return { claimedSol, buySol, swapSig, burnSig, dry };
}

async function claimCreatorFees(apiBase, devWallet){
  const res = await fetch(`${apiBase}/claim-creator-fees`, { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({ recipient: devWallet }) });
  if (!res.ok) return { amountSol: 0 };
  return await res.json();
}
async function marketBuy(jupApi, amountSol, devWallet, tokenMint, slippageBps){
  const inLamports = Math.floor(amountSol * 1e9);
  const q = await fetch(`${jupApi}/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${tokenMint}&amount=${inLamports}&slippageBps=${slippageBps}`);
  if (!q.ok) throw new Error("Jupiter quote failed");
  const quote = await q.json();
  const s = await fetch(`${jupApi}/swap`, { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ quoteResponse: quote, userPublicKey: devWallet, wrapAndUnwrapSol: true }) });
  if (!s.ok) throw new Error("Jupiter swap-build failed");
  return await s.json(); // { swapTransaction }
}
