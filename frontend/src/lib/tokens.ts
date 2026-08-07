import type { Address } from 'viem';

/** Minimal ERC-20 ABI — only what we need for balance checks and transfers. */
export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
] as const;

export interface WatchedToken {
  address: Address;
  symbol: string;
}

/**
 * A small built-in watch list per chain, for the demo. This is intentionally
 * simple: in production, replace this with a live portfolio API (Alchemy
 * Portfolio API, Moralis Wallet API, or Dune SIM) so newly-received tokens
 * are discovered automatically instead of relying on a static list.
 *
 * You can also just add addresses here manually for a hackathon demo token
 * you deploy yourself on a testnet.
 *
 * BSC (chain 56) addresses below are verified against BscScan directly —
 * see the comments for the exact page checked.
 */
export const WATCHED_TOKENS: Record<number, WatchedToken[]> = {
  // Ethereum mainnet — example: USDC. Add more as needed.
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
  ],
  // Sepolia testnet — fill in with your own deployed test token addresses.
  11155111: [],
  // BNB Smart Chain mainnet — Binance-Peg tokens, verified on bscscan.com
  56: [
    // bscscan.com/token/0x55d398326f99059ff775485246999027b3197955
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT' },
    // bscscan.com/token/0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' },
    // bscscan.com/token/0xe9e7cea3dedca5984780bafc599bd69add087d56
    { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD' },
  ],
  // BNB Smart Chain testnet — fill in with your own deployed test token addresses.
  97: [],
};

/** Human-readable native currency label per chain, for display purposes. */
export const NATIVE_LABEL: Record<number, string> = {
  1: 'ETH',
  11155111: 'Sepolia ETH',
  56: 'BNB',
  97: 'Testnet BNB',
};

/**
 * Addresses known to be spam/scam token contracts. Real deployments should
 * pull this from a maintained feed (e.g. a portfolio API's spam flag), but a
 * static blocklist is a reasonable floor for a demo.
 */
export const SPAM_BLOCKLIST = new Set<string>([
  // example entries — replace with a real feed in production
]);

export function isSpamToken(address: Address): boolean {
  return SPAM_BLOCKLIST.has(address.toLowerCase());
}
