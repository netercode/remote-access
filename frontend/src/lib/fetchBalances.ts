import type { Address, PublicClient } from 'viem';
import { erc20Abi, WATCHED_TOKENS, isSpamToken } from './tokens';

export interface ScannedToken {
  address: Address;
  symbol: string;
  decimals: number;
  balance: bigint;
}

export interface ScanResult {
  nativeBalance: bigint;
  tokens: ScannedToken[];
}

/**
 * Scans a wallet for its native balance and any balances in the watched
 * token list for the given chain. Zero-balance and blocklisted tokens are
 * filtered out before being returned, so the UI only ever shows (and the
 * sweep only ever moves) real, non-spam holdings.
 */
export async function scanWallet(
  publicClient: PublicClient,
  owner: Address,
  chainId: number
): Promise<ScanResult> {
  const watchList = WATCHED_TOKENS[chainId] ?? [];
  const candidates = watchList.filter((t) => !isSpamToken(t.address));

  const [nativeBalance, balances, decimalsList] = await Promise.all([
    publicClient.getBalance({ address: owner }),
    candidates.length
      ? publicClient.multicall({
          contracts: candidates.map((t) => ({
            address: t.address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner],
          })),
        })
      : Promise.resolve([]),
    candidates.length
      ? publicClient.multicall({
          contracts: candidates.map((t) => ({
            address: t.address,
            abi: erc20Abi,
            functionName: 'decimals',
          })),
        })
      : Promise.resolve([]),
  ]);

  const tokens: ScannedToken[] = candidates
    .map((t, i) => {
      const balResult = balances[i];
      const decResult = decimalsList[i];
      const balance = balResult?.status === 'success' ? (balResult.result as unknown as bigint) : 0n;
      const decimals = decResult?.status === 'success' ? (decResult.result as unknown as number) : 18;
      return { address: t.address, symbol: t.symbol, decimals, balance };
    })
    .filter((t) => t.balance > 0n);

  return { nativeBalance, tokens };
}
