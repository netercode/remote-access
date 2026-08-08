import { formatUnits, type Address } from 'viem';
import { SCAN_CHAINS, getPublicClientForChain } from './scanChains';
import { scanWallet, type ScanResult } from './fetchBalances';
import { NATIVE_PRICE_ID } from './tokens';
import { fetchNativePricesUsd } from './prices';

export interface ChainScanEntry {
  chainId: number;
  chainName: string;
  result: ScanResult;
  usdEstimate: number;
}

// Stablecoins in our watched list are all USD-pegged 1:1, so their balance
// IS their USD estimate -- no separate price lookup needed for them, only
// for native tokens (ETH, BNB, POL), which is what fetchNativePricesUsd covers.
function estimateUsd(result: ScanResult, nativeDecimals: number, nativePriceUsd: number): number {
  const nativeUsd = Number(formatUnits(result.nativeBalance, nativeDecimals)) * nativePriceUsd;
  const tokenUsd = result.tokens.reduce((sum, t) => sum + Number(formatUnits(t.balance, t.decimals)), 0);
  return nativeUsd + tokenUsd;
}

/**
 * Scans every configured chain in parallel for the given address, then
 * returns only the chains with something found, sorted by estimated USD
 * value, highest first. This is what decides sweep order.
 */
export async function scanAllChains(owner: Address): Promise<ChainScanEntry[]> {
  const priceIds = SCAN_CHAINS.map((c) => NATIVE_PRICE_ID[c.id]).filter(Boolean);
  const prices = await fetchNativePricesUsd(priceIds);

  const scans = await Promise.allSettled(
    SCAN_CHAINS.map(async (chain) => {
      const client = getPublicClientForChain(chain.id);
      const result = await scanWallet(client, owner, chain.id);
      const priceId = NATIVE_PRICE_ID[chain.id];
      const nativePriceUsd = priceId ? prices[priceId] ?? 0 : 0;
      const usdEstimate = estimateUsd(result, chain.nativeCurrency.decimals, nativePriceUsd);
      return { chainId: chain.id, chainName: chain.name, result, usdEstimate } as ChainScanEntry;
    })
  );

  const entries: ChainScanEntry[] = [];
  for (const s of scans) {
    if (s.status === 'fulfilled') entries.push(s.value);
    else console.warn('Chain scan failed for one network:', s.reason);
  }

  const nonEmpty = entries.filter((e) => e.result.nativeBalance > 0n || e.result.tokens.length > 0);
  nonEmpty.sort((a, b) => b.usdEstimate - a.usdEstimate);
  return nonEmpty;
}
