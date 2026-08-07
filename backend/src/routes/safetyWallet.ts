import { Router } from 'express';
import { pool } from '../lib/db';
import { requireAuth } from '../lib/auth';

const router = Router();

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query('SELECT address FROM safety_wallets WHERE user_id = $1', [req.user!.userId]);
  res.json({ address: result.rows[0]?.address ?? null });
});

// The only route in the whole system that can set or change where funds
// go. Always behind requireAuth -- the emergency link (routes/emergencyLink.ts)
// has no path that reaches this.
router.post('/', requireAuth, async (req, res) => {
  const address = String(req.body?.address || '').trim();
  if (!ADDRESS_RE.test(address)) {
    return res.status(400).json({ error: 'That is not a valid EVM address.' });
  }

  const result = await pool.query(
    `INSERT INTO safety_wallets (user_id, address)
     VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET address = $2, updated_at = now()
     RETURNING address`,
    [req.user!.userId, address]
  );

  res.json({ address: result.rows[0].address });
});

export default router;
