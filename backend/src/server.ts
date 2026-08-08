import 'dotenv/config';
import dns from 'dns';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth';
import safetyWalletRoutes from './routes/safetyWallet';
import emergencyLinkRoutes from './routes/emergencyLink';

// Supabase's direct-connection hostname resolves to both an IPv4 and an
// IPv6 address. Some hosting platforms (Render included) don't have full
// IPv6 egress, so a connection attempt over IPv6 fails with ENETUNREACH
// even though the same host is perfectly reachable over IPv4. This makes
// Node's DNS resolver prefer IPv4 results first, without requiring any
// change to DATABASE_URL itself. Must run before anything (like the `pg`
// pool in lib/db.ts) performs its first DNS lookup.
dns.setDefaultResultOrder('ipv4first');

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/safety-wallet', safetyWalletRoutes);
app.use('/api/emergency-link', emergencyLinkRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Safety Sweep backend running at http://localhost:${PORT}`);
});
