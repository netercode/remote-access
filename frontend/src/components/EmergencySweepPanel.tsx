import { useEffect, useState, useRef } from 'react';
import { useAccount } from 'wagmi';
import { switchChain, getWalletClient, getPublicClient } from 'wagmi/actions';
import type { Address } from 'viem';
import { wagmiConfig } from '../lib/wagmiConfig';
import { scanAllChains, type ChainScanEntry } from '../lib/multiChainScan';
import { sweepAll, type SweepProgressEvent } from '../lib/sweep';

const RESERVE_FOR_GAS_WEI = 200_000_000_000_000n;

interface Props {
  safetyAddress: Address;
}

function describeEvent(e: SweepProgressEvent): string {
  switch (e.type) {
    case 'checking-capabilities':
      return '› Checking for one-signature batching support...';
    case 'mode-selected':
      return e.mode === 'batch'
        ? '› Sending everything as one signature.'
        : '› Signing each transfer one at a time.';
    case 'batch-sent':
      return '› Batch submitted. Waiting for confirmation...';
    case 'batch-confirmed':
      return '✓ Batch confirmed on-chain.';
    case 'call-sent':
      return `› [${e.index + 1}/${e.total}] Signed a transfer`;
    case 'call-confirmed':
      return `✓ [${e.index + 1}/${e.total}] Confirmed`;
    case 'done':
      return '✓ Done — moved to your safety wallet.';
    case 'error':
      return `✗ ${e.message}`;
  }
}

type QueueStatus = 'pending' | 'active' | 'done' | 'error';

export function EmergencySweepPanel({ safetyAddress }: Props) {
  const { address, isConnected } = useAccount();

  const [queue, setQueue] = useState<ChainScanEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<number, QueueStatus>>({});
  const [scanning, setScanning] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const hasAutoScanned = useRef(false);

  // Auto-scan every configured chain the instant a wallet connects.
  useEffect(() => {
    if (isConnected && address && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      setScanning(true);
      scanAllChains(address)
        .then((entries) => {
          setQueue(entries);
          const initial: Record<number, QueueStatus> = {};
          entries.forEach((e) => (initial[e.chainId] = 'pending'));
          setStatuses(initial);
        })
        .finally(() => setScanning(false));
    }
    if (!isConnected) {
      hasAutoScanned.current = false;
      setQueue([]);
      setStatuses({});
      setLog([]);
    }
  }, [isConnected, address]);

  const currentEntry = queue.find((e) => statuses[e.chainId] === 'pending');

  async function handleMoveFunds(entry: ChainScanEntry) {
    if (!address) return;
    setSweeping(true);
    setLog([]);
    setStatuses((prev) => ({ ...prev, [entry.chainId]: 'active' }));

    try {
      // Ask the wallet to switch to this chain before signing anything on it.
      await switchChain(wagmiConfig, { chainId: entry.chainId as any });

      const walletClient = await getWalletClient(wagmiConfig, { chainId: entry.chainId as any });
      const publicClient = getPublicClient(wagmiConfig, { chainId: entry.chainId as any });
      if (!walletClient || !publicClient) throw new Error('Could not get a client for this chain.');

      await sweepAll(
        walletClient,
        publicClient as any,
        {
          account: address,
          chainId: entry.chainId,
          safetyAddress,
          tokens: entry.result.tokens,
          nativeBalance: entry.result.nativeBalance,
          reserveForGasWei: RESERVE_FOR_GAS_WEI,
        },
        (event) => {
          setLog((prev) => [...prev, describeEvent(event)]);
          if (event.type === 'done') {
            setStatuses((prev) => ({ ...prev, [entry.chainId]: 'done' }));
          }
          if (event.type === 'error') {
            setStatuses((prev) => ({ ...prev, [entry.chainId]: 'error' }));
          }
        }
      );
    } catch (err: any) {
      setLog((prev) => [...prev, `✗ ${err?.shortMessage ?? err?.message ?? 'Failed to switch or sign.'}`]);
      setStatuses((prev) => ({ ...prev, [entry.chainId]: 'error' }));
    }

    setSweeping(false);
  }

  if (!isConnected) return null;

  const doneCount = queue.filter((e) => statuses[e.chainId] === 'done').length;
  const allDone = queue.length > 0 && doneCount === queue.length;

  return (
    <div className="panel">
      <h2>Emergency sweep</h2>

      {scanning && <p className="muted">Scanning Ethereum, BNB Chain, Base, Arbitrum, Polygon, and Optimism...</p>}

      {!scanning && queue.length === 0 && (
        <p className="muted">Nothing found across any of the 6 supported networks.</p>
      )}

      {queue.length > 0 && (
        <>
          <p className="muted">
            Found funds on {queue.length} network{queue.length === 1 ? '' : 's'}. Processing highest value
            first — {doneCount}/{queue.length} complete.
          </p>

          <div className="chain-queue">
            {queue.map((entry) => {
              const status = statuses[entry.chainId];
              return (
                <div key={entry.chainId} className={`chain-queue-item chain-queue-${status}`}>
                  <span className="chain-queue-name">{entry.chainName}</span>
                  <span className="chain-queue-status">
                    {status === 'done' && '✓ Sent'}
                    {status === 'active' && 'In progress...'}
                    {status === 'error' && '✗ Failed'}
                    {status === 'pending' && 'Waiting'}
                  </span>
                </div>
              );
            })}
          </div>

          {currentEntry && !sweeping && (
            <button
              className="btn btn-danger btn-block"
              style={{ marginTop: 16 }}
              onClick={() => handleMoveFunds(currentEntry)}
            >
              Move funds to safety wallet — {currentEntry.chainName}
            </button>
          )}

          {allDone && <p className="msg-ok" style={{ marginTop: 14 }}>All networks swept to your safety wallet.</p>}
        </>
      )}

      {(sweeping || log.length > 0) && (
        <div className="log-box">
          {log.map((line, i) => (
            <div
              key={i}
              className={line.startsWith('✓') ? 'log-line log-ok' : line.startsWith('✗') ? 'log-line log-err' : 'log-line'}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
