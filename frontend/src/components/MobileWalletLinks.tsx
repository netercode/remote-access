/**
 * Direct "open in wallet's own browser" links, using each wallet's official
 * universal-link format. These completely bypass the WalletConnect relay:
 * the link opens the wallet's native app to THIS EXACT URL inside its own
 * built-in browser, where the wallet injects its own provider directly
 * (same mechanism as a desktop browser extension). No relay, no session
 * handshake over WalletConnect's infrastructure -- which is exactly why
 * this works even when the relay is blocked or degraded on a network.
 *
 * Sources (checked directly, not from memory):
 * - Coinbase Wallet: https://docs.cdp.coinbase.com/coinbase-wallet/developer-guidance/mobile-dapp-integration
 * - Trust Wallet:    https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
 * - MetaMask: MetaMask's own standalone deep-link guide has been folded into
 *   their new "MetaMask Connect" SDK docs (which requires a separate
 *   integration + an Infura API key). The classic universal-link format
 *   below (metamask.app.link/dapp/...) has worked for years and most likely
 *   still does, but wasn't re-confirmed against MetaMask's current docs --
 *   test it directly before relying on it for a demo.
 */

interface WalletLink {
  name: string;
  buildUrl: (currentUrl: string) => string;
  verified: boolean;
}

const WALLET_LINKS: WalletLink[] = [
  {
    name: 'Coinbase Wallet',
    buildUrl: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url)}`,
    verified: true,
  },
  {
    name: 'Trust Wallet',
    buildUrl: (url) => `https://link.trustwallet.com/open_url?coin_id=60&url=${encodeURIComponent(url)}`,
    verified: true,
  },
  {
    name: 'MetaMask',
    buildUrl: (url) => `https://metamask.app.link/dapp/${url.replace(/^https?:\/\//, '')}`,
    verified: false,
  },
];

function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function MobileWalletLinks() {
  if (!isMobileDevice()) return null;

  const currentUrl = window.location.href;

  return (
    <div className="mobile-links">
      <div className="mobile-links-title">Or open directly in your wallet's app</div>
      <p className="muted" style={{ marginTop: 0, marginBottom: 10 }}>
        These skip WalletConnect entirely and go straight into your wallet's own browser — more
        reliable if the list above hangs on loading.
      </p>
      <div className="mobile-links-row">
        {WALLET_LINKS.map((w) => (
          <a
            key={w.name}
            className="btn btn-ghost"
            href={w.buildUrl(currentUrl)}
            rel="noopener noreferrer"
          >
            {w.name}
            {!w.verified && <span className="unverified-badge">unverified</span>}
          </a>
        ))}
      </div>
    </div>
  );
}
