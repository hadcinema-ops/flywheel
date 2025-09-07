# Solana Auto Flywheel (Netlify)

**Prefilled**
- DEV_WALLET: `CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm`
- TOKEN_MINT: `AeR3GYWoEGvpVVS8koTh3nYEEyVZT3XhVWYL1qqUpump`

## Deploy (drag & drop)
1. Zip this folder and upload to **Netlify** (or connect a Git repo).
2. In Netlify → Site Settings → **Environment variables**, add:
   - `RPC_URL` = your Solana RPC endpoint (QuickNode/Helius/mainnet)
   - `DEV_WALLET` = `CVP42X734KgiToYKSWLYfmZ8ULvRLycExPyCV6jR3FWm`
   - `TOKEN_MINT` = `AeR3GYWoEGvpVVS8koTh3nYEEyVZT3XhVWYL1qqUpump`
   - `TX_FEE_BUFFER` = `0.01`
   - `PUMPPORTAL_API` = `https://pumpportal.fun/api/v2`
   - `JUPITER_API` = `https://quote-api.jup.ag/v6`
   - `SLIPPAGE_BPS` = `100`
   - `MIN_BUY_SOL` = `0.02`
   - `MAX_BUY_SOL` = `5`
   - `BURN_METHOD` = `incinerator`
   - `DRY_RUN` = `false`

3. Netlify will install function deps and deploy the frontend and two functions:
   - `/.netlify/functions/flywheel` — HTTP API for stats & Dev Controls
   - Scheduled `flywheel-cron` — executes automatically every 20 minutes

4. Open your site, **Connect Wallet** (Phantom), and use **Test Run (10s)**.

> NOTE: The on-chain swap/burn steps require signing. This template returns a prepared
Jupiter swap transaction for signing; fully unattended signing would require a hot wallet in Netlify secrets (use with caution).
