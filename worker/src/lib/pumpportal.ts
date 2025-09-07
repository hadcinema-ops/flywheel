import fetch from "cross-fetch";

export async function claimCreatorFees(apiBase: string, devWallet: string) {
  // Placeholder: adapt parameters to PumpPortal docs for your token(s).
  const res = await fetch(`${apiBase}/claim-creator-fees`, {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify({ recipient: devWallet })
  });
  if (!res.ok) throw new Error(`PumpPortal claim failed: ${res.status}`);
  const json = await res.json();
  return json as { tx?: string; amountSol?: number };
}
