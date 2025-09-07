import { PublicKey } from "@solana/web3.js";

export const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");

// Placeholder burn helpers to be implemented as needed for your custody model.
// For a keyless worker, prefer building transactions for in-browser signing (frontend).
// For unattended server burn, store a limited hot key in env (risk!).
