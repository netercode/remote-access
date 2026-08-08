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
  // Ethereum mainnet — verified on etherscan.io
  1: [
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
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
  // Base mainnet — native (Circle-issued) USDC, verified on basescan.org.
  // Note: USDbC (bridged, address 0xd9aAEc86...) is intentionally NOT
  // watched — it's the legacy version, native USDC is what has real
  // liquidity now.
  8453: [
    { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC' },
  ],
  // Arbitrum One — native USDC + USDT, verified on arbiscan.io.
  // Note: USDC.e (bridged, 0xFF970A61...) intentionally not watched, same
  // reasoning as Base.
  42161: [
    { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC' },
    { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT' },
  ],
  // Polygon PoS — native USDC + USDT, verified on polygonscan.com
  137: [
    { address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', symbol: 'USDC' },
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT' },
  ],
  // Optimism (OP Mainnet) — native USDC + USDT, verified on optimistic.etherscan.io
  10: [
    { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC' },
    { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT' },
  ],
};

/** Human-readable native currency label per chain, for display purposes. */
export const NATIVE_LABEL: Record<number, string> = {
  1: 'ETH',
  11155111: 'Sepolia ETH',
  56: 'BNB',
  97: 'Testnet BNB',
  8453: 'ETH',
  42161: 'ETH',
  137: 'POL',
  10: 'ETH',
};

/**
 * CoinGecko "simple price" IDs for each chain's native token, used to
 * estimate USD value for sweep ordering. Chains sharing a native asset
 * (Base/Arbitrum/Optimism all use ETH) share an id.
 */
export const NATIVE_PRICE_ID: Record<number, string> = {
  1: 'ethereum',
  8453: 'ethereum',
  42161: 'ethereum',
  10: 'ethereum',
  56: 'binancecoin',
  137: 'matic-network',
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
