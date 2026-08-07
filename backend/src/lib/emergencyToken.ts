import { randomBytes, createHash } from 'crypto';

/**
 * Generates a new bearer token for an emergency link. 256 bits of entropy,
 * URL-safe encoding so it can sit directly in a path segment.
 */
export function generateLinkToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Hashes a token for storage. The raw token is only ever shown to the user
 * once, at creation time -- from then on, only this hash exists anywhere,
 * the same way a password is never stored in plaintext.
 */
export function hashLinkToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
