import { useAccount } from 'wagmi';
import { WATCHED_TOKENS, NATIVE_LABEL } from '../lib/tokens';

/**
 * Shown immediately after connecting, before the user ever touches Scan or
 * Sweep. This is a capability preview, not a balance check — it lists what
 * this tool is configured to recognize on the current network, so the user
 * knows what it can and can't sweep before they commit to anything.
 */
export function NetworkTokensPanel() {
  const { chain, chainId } = useAccount();
  if (!chainId) return null;

  const watched = WATCHED_TOKENS[chainId] ?? [];
  const nativeLabel = NATIVE_LABEL[chainId] ?? chain?.nativeCurrency?.symbol ?? 'native token';

  return (
    <div className="panel">
      <h2>Supported on {chain?.name ?? `chain ${chainId}`}</h2>
      <p className="muted">
        This is what the tool is currently configured to recognize on this network — nothing is
        selected or moved yet. Scanning your wallet checks these for an actual balance.
      </p>
      <div className="token-preview-list">
        <div className="token-preview-item token-preview-native">
          <span className="token-preview-symbol">{nativeLabel}</span>
          <span className="muted">native token</span>
        </div>
        {watched.map((t) => (
          <div key={t.address} className="token-preview-item">
            <span className="token-preview-symbol">{t.symbol}</span>
            <span className="muted mono-address">{t.address}</span>
          </div>
        ))}
      </div>
      {watched.length === 0 && (
        <p className="muted" style={{ marginTop: 10 }}>
          No BEP-20/ERC-20 tokens configured for this network yet — only the native token above
          will be swept. Add addresses in <code>src/lib/tokens.ts</code>.
        </p>
      )}
    </div>
  );
}
