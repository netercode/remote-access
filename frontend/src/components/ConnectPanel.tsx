import { useEffect, useState } from 'react';
import { useAccount, useDisconnect } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { MobileWalletLinks } from './MobileWalletLinks';

// If a connection attempt sits in "connecting" this long without resolving,
// it's almost always the WalletConnect relay (relay.walletconnect.org)
// being blocked or degraded on the user's network -- not the app hanging.
// This is a known, documented issue for some regions/networks; see README.
const SLOW_CONNECTION_HINT_MS = 15_000;

export function ConnectPanel() {
  const { address, isConnected, chain, status } = useAccount();
  const { disconnect } = useDisconnect();
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

  if (isConnected && address) {
    return (
      <div className="panel">
        <h2>Wallet connected</h2>
        <div className="address-box">{address}</div>
        <p className="muted">Network: {chain?.name ?? 'Unknown'}</p>
        <button className="btn btn-ghost" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Connect wallet</h2>
      <p className="muted">
        Choose a wallet from the list. If it's installed on this device, it opens automatically —
        otherwise you'll get a QR code to scan from your phone.
      </p>
      <button className="btn btn-primary btn-block" onClick={() => open()}>
        Connect wallet
      </button>

      <MobileWalletLinks />

      {showSlowHint && (
        <div className="slow-hint">
          <div className="slow-hint-title">Still connecting?</div>
          <p className="muted" style={{ marginBottom: 0 }}>
            This usually means the WalletConnect relay is blocked or slow on your current
            network — a known issue on some mobile networks/ISPs, not a problem with your
            wallet. Try switching networks (WiFi ↔ mobile data) or connecting through a VPN.
            If your wallet has its own built-in browser, opening this site from inside the
            wallet app directly also works around this.
          </p>
        </div>
      )}
    </div>
  );
}
