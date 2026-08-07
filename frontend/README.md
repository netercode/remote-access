# Safety Sweep — frontend

This is the frontend half of a two-part app. See **`../README.md`** at the
project root for the full architecture, the account/security model, and
what's actually been tested. This file covers frontend-specific details:
the sweep engine itself, multi-chain support, and wallet-connection
troubleshooting.

## Design decisions that matter more than the code

This project sits in a category (fast, one-click, multi-token wallet
sweeps) that is mechanically identical to how malicious "wallet drainers"
work. The only thing that separates a rescue tool from a drainer is a small
set of interface guarantees, so they're treated as requirements here, not
style choices:

1. **The destination is never hardcoded.** The safety address is set by
   the account owner (see `../backend`), stored server-side against their
   account, and always fetched fresh — either from `/api/safety-wallet`
   (dashboard, logged in) or `/api/emergency-link/resolve` (emergency
   page, via the link token). There is no third, hidden destination
   anywhere in this codebase.
2. **The destination is always visible before signing** — and before
   connecting a wallet at all. `pages/Emergency.tsx` renders the resolved
   address immediately on load, above the connect button, not gated
   behind any later step. (This was actually broken during development —
   see the root README's testing section for how it was caught and fixed.)
3. **Every transfer is signed by the wallet owner, for their own funds.**
   No `permit`/allowance flow that lets this tool move funds later without
   a fresh signature — every run signs fresh transfers, on the spot.
4. **The button says what it does.** "Send everything to safety wallet
   now" — not a vague reassurance like "Verify" or "Sign safety."
5. **The emergency link can use the address, never change it.** Changing
   the destination always requires a real login — see the root README for
   why this matters once accounts are involved.

If you fork this, keep these five. They're what make the speed defensible
instead of dangerous.


## Working around blocked/degraded WalletConnect relays

Some networks and regions block or throttle `relay.walletconnect.org`,
which makes the "Connect wallet" modal hang indefinitely on "connecting" —
confirmed during real testing (a VPN immediately fixed it, isolating the
cause to relay reachability, not the app). Two things are shipped to
handle this honestly instead of leaving users stuck on a silent spinner:

1. **A 15-second timeout hint** (`ConnectPanel.tsx`) — if a connection
   attempt sits in "connecting" that long, the UI shows a message
   explaining it's likely a network/relay issue, not a broken wallet, and
   suggests switching networks or using a VPN.
2. **Direct wallet deep-links** (`MobileWalletLinks.tsx`), shown on mobile
   only — these open the wallet's own app directly to this exact URL
   inside its built-in browser, where the wallet injects its own provider
   the same way a desktop extension does. This **completely bypasses the
   WalletConnect relay** for the connection itself, since there's no
   relay-mediated handshake involved at all.

Verified, current, official formats used:
- **Coinbase Wallet**: `https://go.cb-w.com/dapp?cb_url=<url>`
- **Trust Wallet**: `https://link.trustwallet.com/open_url?coin_id=60&url=<url>`
- **MetaMask**: `https://metamask.app.link/dapp/<url>` — flagged
  "unverified" in the UI. MetaMask's standalone deep-link guide has been
  folded into their new "MetaMask Connect" SDK (a separate integration
  requiring an Infura API key), so this classic format wasn't re-confirmed
  against their current docs. It's very likely still fine — test it
  directly before a live demo rather than assuming.

There's no way to fully eliminate the underlying relay-blocking issue from
the dApp side — WalletConnect doesn't support self-hosting or an
alternate relay endpoint for third-party apps (confirmed via their own
FAQ), so a VPN remains the only fix for the "Connect wallet" modal itself
in affected regions. The deep-links above are the real workaround.

## Multi-chain support (Ethereum, BNB Chain, and beyond)

The sweep mechanism has no chain-specific logic anywhere in it — `sweep.ts`
and `fetchBalances.ts` operate purely on whatever `chainId` and RPC client
wagmi hands them. BEP-20 (BNB Smart Chain's token standard) implements the
identical `balanceOf`/`transfer` interface as ERC-20, so the same code
sweeps both without modification.

**Configured out of the box:**
- Ethereum mainnet (chain 1) + Sepolia testnet (chain 11155111)
- BNB Smart Chain mainnet (chain 56) + testnet (chain 97), watching the
  three main Binance-Peg stablecoins — addresses verified directly against
  BscScan (see comments in `src/lib/tokens.ts`):
  - USDT: `0x55d398326f99059fF775485246999027B3197955`
  - USDC: `0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d`
  - BUSD: `0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56`

**Proven, not assumed:** `test:sweep` was run twice — once with the local
chain reporting Ethereum-style defaults, and again with `chain: { chainId:
56 }` explicitly set (BNB Smart Chain's real chain ID) — and `sweepAll()`
correctly moved both test tokens and the native balance in both runs, with
zero code changes between them. That's what "chain-agnostic" means here:
verified by actually running it against a different chain ID, not just
argued from the code shape.

**Adding another EVM chain** (Polygon, Arbitrum, Base, etc.) is two edits:
1. Import the chain from `wagmi/chains` and add it to `chains`/`transports`
   in `src/lib/wagmiConfig.ts`
2. Add its watched tokens to `WATCHED_TOKENS` in `src/lib/tokens.ts`

No other file needs to change — the scan, confirm, and sweep logic already
works for any chain in that config.

## Pre-sweep token visibility

Before any scan or sweep action, `NetworkTokensPanel` shows exactly what
this tool is configured to recognize on the connected network — the native
token plus every watched BEP-20/ERC-20 address — so you always know what
it *can* sweep before you click anything. Clicking "Scan my wallet" then
checks those specific addresses for an actual non-zero balance and lets
you deselect individual tokens before confirming.

## Wallet connection & mobile deep-linking

Wallet connection is handled by **Reown AppKit** (formerly WalletConnect
Modal / Web3Modal), wired to the same wagmi config the rest of the app
uses. Clicking "Connect wallet" opens Reown's modal, which:

- Lists every injected browser wallet it detects (via EIP-6963) — MetaMask,
  Rabby, Coinbase Wallet extension, etc.
- Lists WalletConnect-registered wallets for QR/mobile connection
- **Deep-links automatically on mobile** — if you open the site on your
  phone and pick a wallet that's installed, WalletConnect opens that app
  directly instead of showing a QR code. This is built into the
  WalletConnect protocol itself, not custom logic in this app.

**This requires your own free Reown project ID to actually render the
modal** — without one, `open()` fails silently (confirmed during testing:
the correct API calls fire to `api.web3modal.org` with the right
parameters, they just get rejected because there's no real project ID
behind the placeholder used during development, and with a fake ID the
call correctly throws zero uncaught exceptions — it just can't render UI
without a real config response). Get one at https://cloud.reown.com, then:

```bash
cp .env.example .env
# set VITE_WALLETCONNECT_PROJECT_ID=<your id>
```

Note: this project runs on **wagmi v3** (not v2) specifically because
`@reown/appkit-adapter-wagmi` needs `@wagmi/core` v3 internally — mixing
wagmi v2 with the current AppKit packages produces a real type conflict
between two different copies of `@wagmi/core` in the dependency tree
(caught by `tsc`, not just a lint nit) and a broken production build. If
you're adding AppKit to an existing wagmi v2 project, budget time for this
upgrade — it's not optional despite AppKit's peer dependency range
technically allowing v2.

## How the sweep works

1. **Scan** — `scanWallet()` reads native balance plus any watched ERC-20
   balances via multicall, filters zero balances and anything in the spam
   blocklist, and returns the result to review before anything is signed.
2. **Confirm** — the UI shows the safety address and the token list with
   checkboxes; nothing is preselected out of your control.
3. **Sweep** — `sweepAll()` in `src/lib/sweep.ts`:
   - Checks whether the connected wallet supports **EIP-5792** batching
     (`wallet_getCapabilities`). If so, every transfer is sent as **one
     atomic batch, one signature** (`wallet_sendCalls`).
   - If not, it falls back to signing each transfer **sequentially** —
     still fully functional, just one popup per token instead of one
     total.
   - The native-token transfer always goes last, after reserving enough
     gas to pay for its own transaction.

## This has been tested against a real chain, not just compiled

`scripts/test-sweep-logic.mjs` spins up a local Ganache chain, deploys two
real ERC-20 contracts, funds a test wallet, and runs the **actual**
`sweepAll()` function the app uses — not a reimplementation. It verifies:

- The source wallet ends at exactly 0 for every token
- The safety wallet receives the full original balance of every token
- Native balance moves correctly, minus only the reserved gas
- The sequential fallback path works correctly (a plain node has no
  EIP-5792 support, so this also proves that code path specifically)

Run it yourself:
```bash
npm install
npm run test:sweep
```

The EIP-5792 **batch** path is written and type-checked but not yet run
against a live wallet in this environment — no EIP-5792-capable wallet was
available to test against here. Before a hackathon demo, test the batch
path against a real MetaMask (v12+) or Coinbase Wallet on Sepolia to
confirm the `wallet_sendCalls` flow behaves as expected on your target
wallet.

## Setup

This frontend needs the backend running too — see `../README.md` for the
full two-part setup. Frontend-only steps:

```bash
npm install
cp .env.example .env
# set VITE_API_URL to your backend (default http://localhost:4000)
# add a WalletConnect project ID from https://cloud.reown.com
npm run dev
```

Open http://localhost:5173. Injected wallets (MetaMask, Rabby, etc.) work
immediately with no configuration; WalletConnect needs the project ID.

## Adding tokens to watch

Edit `src/lib/tokens.ts` → `WATCHED_TOKENS`. Add your own testnet token
addresses under the Sepolia chain ID (`11155111`) for a demo, or real
token addresses under mainnet (`1`) for production. In production, replace
this static list with a live portfolio API (Alchemy Portfolio API, Moralis
Wallet API, or Dune SIM) so newly received tokens are discovered
automatically instead of requiring a manual add.

## Known limitations / next steps

- **Spam filtering is a static blocklist right now** (`SPAM_BLOCKLIST` in
  `tokens.ts`), effectively empty by default. Wire it to a real feed
  before relying on it.
- **No transaction simulation before signing yet.** Adding Tenderly's
  Simulation API or Blockaid would let the confirm screen show *exactly*
  what will happen before the user signs — a strong addition for a
  security-focused pitch.
- **No commit-reveal or other on-chain fairness proof** — not applicable
  here the way it would be for a randomness-based tool, but if you extend
  this toward anything involving trust in an automated/third-party
  process, that's the pattern to reach for.
- Gas reserve (`RESERVE_FOR_GAS_WEI` in `SweepPanel.tsx`) is a fixed
  estimate. A production version should estimate gas dynamically per
  network.

## Stack

wagmi v2 + viem · React + Vite + TypeScript · EIP-6963 wallet discovery
(via wagmi's default `injected()` connector) · EIP-5792 batching with
EIP-7702-aware wallets, sequential fallback otherwise.
