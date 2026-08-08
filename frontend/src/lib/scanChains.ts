import { createPublicClient, http, type PublicClient } from 'viem';
import { mainnet, bsc, base, arbitrum, polygon, optimism } from 'viem/chains';
import type { Chain } from 'viem/chains';

/**
 * The 6 chains this app scans. Balance reads don't require the wallet to be
 * "on" any particular chain -- these clients talk directly to each chain's
 * own public RPC, independent of whatever network the connected wallet
 * currently has active. That's what makes scanning all 6 in parallel on
 * connect possible at all.
 */
export const SCAN_CHAINS: Chain[] = [mainnet, bsc, base, arbitrum, polygon, optimism];

const clientCache = new Map<number, PublicClient>();

export function getPublicClientForChain(chainId: number): PublicClient {
  const cached = clientCache.get(chainId);
  if (cached) return cached;

  const chain = SCAN_CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`No chain config for chain id ${chainId}`);

  const client = createPublicClient({ chain, transport: http() }) as PublicClient;
  clientCache.set(chainId, client);
  return client;
}
