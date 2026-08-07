import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';

import authRoutes from './routes/auth';
import safetyWalletRoutes from './routes/safetyWallet';
import emergencyLinkRoutes from './routes/emergencyLink';

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
