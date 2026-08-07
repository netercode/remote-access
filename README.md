# Safety Sweep (multi-user, with accounts)

An emergency wallet-rescue service: create an account, set a safety wallet
once, and get a personal emergency link. Opening that link in a wallet's
dApp browser connects, scans, and sweeps everything to your saved address
in one click — no login, no re-typing an address, no per-visit setup.

This is the account-based evolution of a single-user tool. If you want the
simpler, no-backend, single-person version (safety address stored in the
browser, no accounts), that's a separate, already-working project — this
one exists specifically for serving multiple users as a real product.

## Why the account model exists, and what it changes

The core safety property from the single-user version carries over
unchanged: **the emergency link can never change where funds go.** But
introducing accounts adds a new thing that has to be protected —
previously, the safety address lived only in one person's own browser,
untouchable by anyone else. Now it lives in a shared database, reachable
by a login. That makes **account security the safety-critical surface**,
not an afterthought:

- Changing the safety wallet **always** requires an authenticated session
  (`routes/safetyWallet.ts` — every route behind `requireAuth`, no
  exceptions).
- The emergency link is a separate, narrower credential: a 256-bit random
  token, stored as a SHA-256 hash (never in plaintext — same treatment as
  a password). It can **read and use** the saved address; it has **no
  code path** that can modify it.
- Regenerating a link immediately revokes the previous one (tested: see
  "What's been tested" below). If a link leaks, replacing it closes the
  hole instantly.

If you're extending this: **do not add a way to change the safety address
without `requireAuth`.** That single boundary is what keeps this a rescue
tool instead of a liability.

## Architecture

```
backend/   Express + PostgreSQL (raw SQL via `pg`, no ORM) + JWT auth
  ├── auth: signup, login, logout — email/password, scrypt-hashed
  ├── safety-wallet: GET/POST, requires login
  └── emergency-link: generate/regenerate/revoke (login required,
      token shown once) · resolve (public — the token IS the credential)

frontend/  Vite + React + TypeScript + react-router
  ├── /            landing
  ├── /signup, /login, /dashboard   account + safety wallet + link management
  └── /e/:token    the emergency page: resolves token → shows the address
                   immediately (before connecting) → Connect wallet →
                   auto-scans the instant it connects → one "Send
                   everything" button
```

The actual sweep mechanism (`frontend/src/lib/sweep.ts`, `fetchBalances.ts`,
`tokens.ts`, `wagmiConfig.ts`) is carried over unchanged from the
single-user version — it was already tested end-to-end against a real
local chain (twice: once simulating Ethereum, once simulating BNB Smart
Chain's real chain ID) and that test was re-run against this copy to
confirm nothing broke in the move.

## Setup

### 1. Backend

```bash
cd backend
npm install
createdb safety_sweep   # or use an existing PostgreSQL instance
psql -d safety_sweep -f schema.sql
cp .env.example .env
# fill in DATABASE_URL and generate a JWT_SECRET:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run dev
```

Runs on `http://localhost:4000` by default.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# set VITE_API_URL to your backend's URL
# set VITE_WALLETCONNECT_PROJECT_ID (free, from https://cloud.reown.com)
npm run dev
```

Runs on `http://localhost:5173` by default.

## What's been tested, and how

Everything below was actually run, not just reasoned about:

- **Backend, via curl against a real PostgreSQL database:** signup,
  duplicate-email rejection, weak-password rejection, wrong-password
  rejection, login, `requireAuth` correctly blocking unauthenticated
  requests (401), setting/reading the safety wallet, generating an
  emergency link, resolving it **with zero cookies** (proving it truly
  works without login), rejecting an invalid token (404), and — the most
  safety-critical property — **regenerating a link immediately revokes the
  previous token**, confirmed by resolving the old token again afterward
  and getting a 404.
- **Frontend, via Playwright browser automation:** full signup → dashboard
  → set safety wallet → generate emergency link → **open that link in a
  brand-new browser context with no cookies at all** → confirmed the
  address renders before any wallet connects, "Connect wallet" appears,
  and an invalid/fake token shows a clear error instead of failing
  silently. Zero uncaught JavaScript exceptions throughout.
- **One real bug was caught and fixed by this testing, not by review:**
  the emergency page's destination address was only rendering *after* a
  wallet connected, even though the page's own footer text claimed it was
  "shown above." Fixed by moving the address banner above the connect
  step, and re-tested to confirm.
- **The sweep mechanism itself** — unchanged from the single-user
  version — re-run against a local chain after being copied into this
  project, still passing (`npm run test:sweep` in `frontend/`).

## What hasn't been tested / known gaps

- **The actual wallet-signing steps** (connect, scan, sweep) were verified
  for UI correctness and API wiring, but not against a live wallet with
  real funds — there's no wallet extension available in the environment
  this was built in. Test with a real wallet on a testnet before trusting
  this with real funds.
- **No email verification, password reset, or rate limiting** on
  auth/login endpoints yet. Add rate limiting before this is
  public-facing — brute-forcing a weak password is the most direct way to
  a redirected safety wallet.
- **No confirmation step (e.g. email notice) when the safety wallet
  changes.** Right now, anyone with valid login credentials can silently
  change the destination. For a real product, notifying the account email
  on every change is a strong, cheap addition.
- **JWT secret rotation isn't handled.** Rotating `JWT_SECRET` invalidates
  every existing session at once — fine for now, worth a proper strategy
  before scale.
- Same multi-chain, spam-filtering, and gas-reserve caveats as the
  single-user version — see inline comments in `frontend/src/lib/`.
