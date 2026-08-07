import { useEffect, useState, useRef } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { formatEther, formatUnits, type Address } from 'viem';
import { scanWallet, type ScanResult } from '../lib/fetchBalances';
import { NATIVE_LABEL } from '../lib/tokens';
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
      return `› Batch submitted. Waiting for confirmation...`;
    case 'batch-confirmed':
      return '✓ Batch confirmed on-chain.';
    case 'call-sent':
      return `› [${e.index + 1}/${e.total}] Signed: ${e.label}`;
    case 'call-confirmed':
      return `✓ [${e.index + 1}/${e.total}] Confirmed: ${e.label}`;
    case 'done':
      return '✓ Done. Everything is in your safety wallet.';
    case 'error':
      return `✗ ${e.message}`;
  }
}

export function EmergencySweepPanel({ safetyAddress }: Props) {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const hasAutoScanned = useRef(false);

  // Auto-scan the moment a wallet connects -- no button, no extra step.
  useEffect(() => {
    if (isConnected && address && chainId && publicClient && !hasAutoScanned.current) {
      hasAutoScanned.current = true;
      setScanning(true);
      scanWallet(publicClient, address, chainId)
        .then(setScanResult)
        .finally(() => setScanning(false));
    }
    if (!isConnected) {
      hasAutoScanned.current = false;
      setScanResult(null);
      setDone(false);
      setLog([]);
    }
  }, [isConnected, address, chainId, publicClient]);

  async function handleSend() {
    if (!walletClient || !publicClient || !address || !chainId || !scanResult) return;
    setSweeping(true);
    setDone(false);
    setLog([]);

    await sweepAll(
      walletClient,
      publicClient,
      {
        account: address,
        chainId,
        safetyAddress,
        tokens: scanResult.tokens, // everything found, no manual selection in this flow
        nativeBalance: scanResult.nativeBalance,
        reserveForGasWei: RESERVE_FOR_GAS_WEI,
      },
      (event) => {
        setLog((prev) => [...prev, describeEvent(event)]);
        if (event.type === 'done') setDone(true);
      }
    );

    setSweeping(false);
  }

  if (!isConnected) return null;

  const nativeToSend =
    scanResult && scanResult.nativeBalance > RESERVE_FOR_GAS_WEI
      ? scanResult.nativeBalance - RESERVE_FOR_GAS_WEI
      : 0n;
  const nativeLabel = NATIVE_LABEL[chainId ?? 0] ?? 'native token';
  const hasAnythingToSend = !!scanResult && (nativeToSend > 0n || scanResult.tokens.length > 0);

  return (
    <div className="panel">
      <h2>Wallet contents</h2>

      {scanning && <p className="muted">Scanning your wallet...</p>}

      {scanResult && !sweeping && !done && (
        <>
          <div className="token-row token-row-native">
            <span>{formatEther(nativeToSend)} {nativeLabel}</span>
            <span className="muted">(gas reserved)</span>
          </div>
          {scanResult.tokens.map((t) => (
            <div key={t.address} className="token-row">
              <span>{formatUnits(t.balance, t.decimals)} {t.symbol}</span>
            </div>
          ))}
          {!hasAnythingToSend && <p className="muted">Nothing found to sweep on this network.</p>}

          {hasAnythingToSend && (
            <button className="btn btn-danger btn-block" style={{ marginTop: 16 }} onClick={handleSend}>
              Send everything to safety wallet now
            </button>
          )}
        </>
      )}

      {(sweeping || log.length > 0) && (
        <div className="log-box">
          {log.map((line, i) => (
            <div key={i} className={line.startsWith('✓') ? 'log-line log-ok' : line.startsWith('✗') ? 'log-line log-err' : 'log-line'}>
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
