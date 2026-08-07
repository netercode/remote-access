import { encodeFunctionData, type Address, type PublicClient, type WalletClient } from 'viem';
import { erc20Abi } from './tokens';
import type { ScannedToken } from './fetchBalances';

export interface SweepCall {
  to: Address;
  data: `0x${string}`;
  value: bigint;
  label: string; // human-readable description for the progress log
}

export interface SweepParams {
  account: Address;
  chainId: number;
  safetyAddress: Address; // ALWAYS the visible, user-set destination
  tokens: ScannedToken[];
  nativeBalance: bigint;
  reserveForGasWei: bigint; // left behind to cover the final native transfer's own gas
}

export type SweepProgressEvent =
  | { type: 'checking-capabilities' }
  | { type: 'mode-selected'; mode: 'batch' | 'sequential' }
  | { type: 'call-sent'; index: number; total: number; label: string; hash?: `0x${string}` }
  | { type: 'call-confirmed'; index: number; total: number; label: string }
  | { type: 'batch-sent'; batchId: string }
  | { type: 'batch-confirmed' }
  | { type: 'done' }
  | { type: 'error'; message: string };

/** Builds the transfer calls. Native transfer is always last, after reserving gas. */
export function buildSweepCalls(params: Omit<SweepParams, 'account' | 'chainId'>): SweepCall[] {
  const { safetyAddress, tokens, nativeBalance, reserveForGasWei } = params;

  const calls: SweepCall[] = tokens.map((t) => ({
    to: t.address,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [safetyAddress, t.balance],
    }),
    value: 0n,
    label: `Transfer ${t.symbol} to safety wallet`,
  }));

  const nativeToSend = nativeBalance > reserveForGasWei ? nativeBalance - reserveForGasWei : 0n;
  if (nativeToSend > 0n) {
    calls.push({
      to: safetyAddress,
      data: '0x',
      value: nativeToSend,
      label: 'Transfer native balance to safety wallet',
    });
  }

  return calls;
}

async function getWalletCapabilities(walletClient: WalletClient, account: Address): Promise<any> {
  try {
    return await walletClient.request({
      method: 'wallet_getCapabilities' as any,
      params: [account] as any,
    });
  } catch {
    return null;
  }
}

function chainSupportsAtomicBatch(capabilities: any, chainId: number): boolean {
  if (!capabilities) return false;
  const hex = `0x${chainId.toString(16)}`;
  const chainCaps = capabilities[hex] ?? capabilities[chainId as unknown as string];
  if (!chainCaps) return false;
  const atomic = chainCaps.atomic ?? chainCaps.atomicBatch;
  if (!atomic) return false;
  return atomic.status === 'supported' || atomic.status === 'ready' || atomic.supported === true;
}

async function sendBatch(
  walletClient: WalletClient,
  account: Address,
  chainId: number,
  calls: SweepCall[]
): Promise<string> {
  const idHex = `0x${chainId.toString(16)}`;
  const result: any = await walletClient.request({
    method: 'wallet_sendCalls' as any,
    params: [
      {
        version: '1.0',
        chainId: idHex,
        from: account,
        atomicRequired: true,
        calls: calls.map((c) => ({ to: c.to, data: c.data, value: `0x${c.value.toString(16)}` })),
      },
    ] as any,
  });
  return typeof result === 'string' ? result : result?.id ?? '';
}

async function pollBatchStatus(walletClient: WalletClient, batchId: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    const status: any = await walletClient.request({
      method: 'wallet_getCallsStatus' as any,
      params: [batchId] as any,
    });
    const code = status?.status;
    if (code === 200 || code === 'CONFIRMED' || status?.receipts?.length) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/**
 * Executes the sweep. Tries an atomic EIP-5792 batch (one signature) first;
 * if the connected wallet doesn't support it, falls back to signing each
 * transfer sequentially. Every call moves funds to `params.safetyAddress`
 * only — the address the user set and can see on screen, never a value
 * baked in separately from what's displayed.
 */
export async function sweepAll(
  walletClient: WalletClient,
  publicClient: PublicClient,
  params: SweepParams,
  onProgress: (event: SweepProgressEvent) => void
): Promise<void> {
  try {
    const calls = buildSweepCalls(params);
    if (calls.length === 0) {
      onProgress({ type: 'done' });
      return;
    }

    onProgress({ type: 'checking-capabilities' });
    const capabilities = await getWalletCapabilities(walletClient, params.account);
    const canBatch = chainSupportsAtomicBatch(capabilities, params.chainId);

    if (canBatch) {
      onProgress({ type: 'mode-selected', mode: 'batch' });
      const batchId = await sendBatch(walletClient, params.account, params.chainId, calls);
      onProgress({ type: 'batch-sent', batchId });
      await pollBatchStatus(walletClient, batchId);
      onProgress({ type: 'batch-confirmed' });
      onProgress({ type: 'done' });
      return;
    }

    onProgress({ type: 'mode-selected', mode: 'sequential' });
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const hash = await walletClient.sendTransaction({
        account: params.account,
        chain: null,
        to: call.to,
        data: call.data,
        value: call.value,
      });
      onProgress({ type: 'call-sent', index: i, total: calls.length, label: call.label, hash });
      await publicClient.waitForTransactionReceipt({ hash });
      onProgress({ type: 'call-confirmed', index: i, total: calls.length, label: call.label });
    }

    onProgress({ type: 'done' });
  } catch (err: any) {
    onProgress({ type: 'error', message: err?.shortMessage ?? err?.message ?? 'Sweep failed.' });
  }
}
