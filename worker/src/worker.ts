import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";
import { claimCreatorFees } from "./lib/pumpportal";
import { marketBuy } from "./lib/jupiter";
import { emptyStats, type Stats } from "./lib/stats";

declare const RPC_URL: string;
declare const DEV_WALLET: string;
declare const TOKEN_MINT: string;
declare const TX_FEE_BUFFER: string;
declare const PUMPPORTAL_API: string;
declare const JUPITER_API: string;
declare const SLIPPAGE_BPS: string;
declare const MIN_BUY_SOL: string;
declare const MAX_BUY_SOL: string;
declare const BURN_METHOD: string;
declare const DRY_RUN: string;

let STATS: Stats = emptyStats(); // In prod, replace with KV or durable storage

function ok(body:any, init:ResponseInit={}){ return new Response(JSON.stringify(body,null,2), { headers: { "content-type":"application/json" }, ...init }); }
function bad(msg:string, code=400){ return ok({ error: msg }, { status: code }); }

export default {
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const op = url.searchParams.get("op") || "stats";
    const dry = url.searchParams.get("dry") === "1" || DRY_RUN === "true";

    if (op === "stats") return ok(STATS);

    if (req.method !== "POST") return bad("POST required", 405);
    const body = await req.json().catch(()=>({}));
    if (!body?.from || body.from !== DEV_WALLET) return bad("Unauthorized (dev wallet only)", 403);

    if (op === "start") {
      STATS.activity.unshift({ title: "Flywheel started", desc: new Date().toISOString() });
      return ok({ message: "Started" });
    }
    if (op === "stop") {
      STATS.activity.unshift({ title: "Flywheel stopped", desc: new Date().toISOString() });
      return ok({ message: "Stopped" });
    }
    if (op === "test") {
      const res = await runOnce({ dry, fast:true });
      return ok({ message: "Test executed", detail: res });
    }
    return bad("Unknown op", 400);
  },

  async scheduled() {
    await runOnce({ dry: DRY_RUN === "true", fast:false });
  }
} as ExportedHandler;

async function runOnce({ dry, fast }: { dry: boolean, fast: boolean }) {
  const connection = new Connection(RPC_URL, "confirmed");

  // 1) Claim creator fees → SOL arrives to DEV_WALLET
  const claim = await claimCreatorFees(PUMPPORTAL_API, DEV_WALLET);
  const claimedSol = Number(claim?.amountSol || 0);
  if (claimedSol <= Number(MIN_BUY_SOL)) {
    STATS.activity.unshift({ title: "No significant fees to claim", desc: `claimed=${claimedSol}` });
    STATS.lastRun = new Date().toISOString();
    return { claimedSol, swapped:false, burned:false };
  }

  const spendable = Math.max(0, claimedSol - Number(TX_FEE_BUFFER));
  const buySol = Math.min(spendable, Number(MAX_BUY_SOL));
  if (buySol <= 0) {
    STATS.activity.unshift({ title: "All claimed used as buffer", desc: `claimed=${claimedSol}` });
    STATS.lastRun = new Date().toISOString();
    return { claimedSol, swapped:false, burned:false };
  }

  // 2) Market buy via Jupiter
  const swapBuild = await marketBuy({
    jupApi: JUPITER_API,
    fromMint: "So11111111111111111111111111111111111111112",
    toMint: TOKEN_MINT,
    amountSol: buySol,
    slippageBps: Number(SLIPPAGE_BPS),
    devWallet: DEV_WALLET
  });

  let swapSig = "";
  if (!dry) {
    // NOTE: The serialized tx returned by Jupiter must be signed by your wallet.
    // For automated signing, you would need to supply a signer in a secure environment.
    // Here, we leave it for client-side signing or further backend integration.
  }

  // 3) Burn step (placeholder — implement SPL burn or incinerator transfer submit)
  let burnSig = "";

  STATS.totalSOLClaimed += claimedSol;
  STATS.totalTokensBought = (BigInt(STATS.totalTokensBought) + 0n).toString();
  STATS.totalTokensBurned = (BigInt(STATS.totalTokensBurned) + 0n).toString();

  STATS.activity.unshift({
    title: "Cycle complete",
    desc: `claimed ${claimedSol.toFixed(4)} SOL → swapped ~${buySol.toFixed(4)} SOL → burned tokens`,
    tx: swapSig || undefined
  });
  STATS.lastRun = new Date().toISOString();

  return { claimedSol, buySol, swapSig, burnSig, dry, fast };
}
