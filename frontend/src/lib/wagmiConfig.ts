import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { createAppKit } from '@reown/appkit/react';
import { mainnet, sepolia, bsc, bscTestnet } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';

// Get your own free project ID at https://cloud.reown.com and put it in a
// .env file as VITE_WALLETCONNECT_PROJECT_ID=xxxx. Without it, the wallet
// list will only show injected browser wallets (MetaMask, Rabby, etc.) —
// WalletConnect's full wallet list and mobile deep-linking need a real ID.
const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

if (!projectId) {
  console.warn(
    'VITE_WALLETCONNECT_PROJECT_ID is not set — only injected browser wallets will be offered. ' +
      'Get a free project ID at https://cloud.reown.com for the full wallet list + mobile deep-linking.'
  );
}

const networks = [bsc, mainnet, sepolia, bscTestnet] as [AppKitNetwork, ...AppKitNetwork[]];

const metadata = {
  name: 'Safety Sweep',
  description: 'Emergency EVM wallet rescue tool',
  url: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173',
  icons: [],
};

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId: projectId ?? 'MISSING_PROJECT_ID',
  ssr: false,
});

// Registers the <appkit-button> / useAppKit() modal globally. This is what
// renders the wallet list (injected wallets via EIP-6963 + every
// WalletConnect-registered wallet) and handles mobile deep-linking: if the
// chosen wallet's app is installed on the same device, WalletConnect opens
// it directly instead of showing a QR code.
createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: projectId ?? 'MISSING_PROJECT_ID',
  metadata,
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
    history: false,
  },
  themeMode: 'dark',
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
