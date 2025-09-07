import fetch from "cross-fetch";

export async function marketBuy({
  jupApi, fromMint, toMint, amountSol, slippageBps, devWallet
}: {
  jupApi: string, fromMint: string, toMint: string, amountSol: number, slippageBps: number, devWallet: string
}) {
  const inLamports = Math.floor(amountSol * 1e9);
  const quoteUrl = `${jupApi}/quote?inputMint=${fromMint}&outputMint=${toMint}&amount=${inLamports}&slippageBps=${slippageBps}`;
  const q = await fetch(quoteUrl);
  if (!q.ok) throw new Error("Jupiter quote failed");
  const quote = await q.json();

  const swapReq = await fetch(`${jupApi}/swap`, {
    method: "POST",
    headers: {"content-type":"application/json"},
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: devWallet,
      wrapAndUnwrapSol: true
    })
  });
  if (!swapReq.ok) throw new Error("Jupiter swap-build failed");
  const { swapTransaction } = await swapReq.json();
  return { swapTransaction };
}
