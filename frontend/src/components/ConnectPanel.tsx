import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { MobileWalletLinks } from './MobileWalletLinks';

// If a connection attempt sits in "connecting" this long without resolving,
// it's almost always the WalletConnect relay (relay.walletconnect.org)
// being blocked or degraded on the user's network -- not the app hanging.
const SLOW_CONNECTION_HINT_MS = 15_000;

export function ConnectPanel() {
  const { isConnected, status } = useAccount();
  const { open } = useAppKit();
  const [showSlowHint, setShowSlowHint] = useState(false);

  useEffect(() => {
    if (status !== 'connecting') {
      setShowSlowHint(false);
      return;
    }
    const timer = setTimeout(() => setShowSlowHint(true), SLOW_CONNECTION_HINT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  // Once connected, this component gets out of the way entirely -- no
  // address, no network name, no disconnect button. The sweep panel takes
  // over from here.
  if (isConnected) return null;

  return (
    <div className="panel">
      <button className="btn btn-primary btn-block" onClick={() => open()}>
        Connect wallet
      </button>

      <MobileWalletLinks />

      {showSlowHint && (
        <div className="slow-hint">
          <div className="slow-hint-title">Still connecting?</div>
          <p className="muted" style={{ marginBottom: 0 }}>
            This usually means the WalletConnect relay is blocked or slow on your current
            network — try switching networks (WiFi ↔ mobile data), or connecting through a
            VPN. If your wallet has its own built-in browser, opening this link from inside the
            wallet app directly also works around this.
          </p>
        </div>
      )}
    </div>
  );
}
