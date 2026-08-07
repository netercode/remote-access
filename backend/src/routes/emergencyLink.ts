import { Router } from 'express';
import { pool } from '../lib/db';
import { requireAuth } from '../lib/auth';
import { generateLinkToken, hashLinkToken } from '../lib/emergencyToken';

const router = Router();

// Whether the logged-in user currently has an active emergency link.
// The raw token is never retrievable again after creation, so this only
// ever reports existence, never the token itself.
router.get('/', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, created_at FROM emergency_links WHERE user_id = $1 AND revoked_at IS NULL LIMIT 1',
    [req.user!.userId]
  );
  const active = result.rows[0];
  res.json({ active: !!active, createdAt: active?.created_at ?? null });
});

// Creates a new link, revoking any previous one. The raw token is
// returned exactly once, in this response -- copy it now, it's gone after.
router.post('/regenerate', requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const rawToken = generateLinkToken();
  const tokenHash = hashLinkToken(rawToken);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE emergency_links SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [userId]
    );
    await client.query(
      'INSERT INTO emergency_links (user_id, token_hash) VALUES ($1, $2)',
      [userId, tokenHash]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.json({ token: rawToken });
});

router.post('/revoke', requireAuth, async (req, res) => {
  await pool.query(
    'UPDATE emergency_links SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
    [req.user!.userId]
  );
  res.json({ ok: true });
});

// PUBLIC -- no login. This is the entire point of the emergency link: it
// works instantly under pressure. It can only ever return the safety
// address already on file; there is no path here that can change it.
router.post('/resolve', async (req, res) => {
  const token = String(req.body?.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token.' });

  const tokenHash = hashLinkToken(token);
  const linkResult = await pool.query(
    `SELECT el.revoked_at, sw.address
     FROM emergency_links el
     LEFT JOIN safety_wallets sw ON sw.user_id = el.user_id
     WHERE el.token_hash = $1`,
    [tokenHash]
  );

  const link = linkResult.rows[0];
  if (!link || link.revoked_at) {
    return res.status(404).json({ error: 'This link is invalid or has been revoked.' });
  }
  if (!link.address) {
    return res.status(409).json({ error: 'This account has no safety wallet set up yet.' });
  }

  res.json({ safetyAddress: link.address });
});

export default router;
