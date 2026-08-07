import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not set. Generate one and add it to .env before starting the server.');
}

const COOKIE_NAME = 'session';
const TOKEN_TTL = '7d';

export interface AuthPayload {
  userId: string;
  email: string;
}

export function signSession(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: TOKEN_TTL });
}

export function verifySession(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET!) as AuthPayload;
  } catch {
    return null;
  }
}

// In production, the frontend (e.g. vercel.app) and backend (e.g.
// railway.app) are on different domains. A browser will NOT send a
// SameSite=Lax cookie on a cross-site fetch() request -- only same-site
// navigations. Cross-domain deployments need SameSite=None, which in turn
// requires Secure (HTTPS-only). Locally, both frontend and backend run on
// localhost over plain HTTP, so Lax + non-secure is used there instead --
// None+Secure cookies are simply dropped over HTTP.
const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions = {
  httpOnly: true,
  sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
  secure: isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, cookieOptions);
}

export function clearSessionCookie(res: Response) {
  // clearCookie must be called with matching attributes (minus maxAge) or
  // some browsers won't actually remove the cookie.
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: cookieOptions.sameSite, secure: cookieOptions.secure });
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/** Requires a valid session cookie. Used for anything that can read or change account data. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifySession(token) : null;
  if (!payload) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.user = payload;
  next();
}

export function getSessionFromRequest(req: Request): AuthPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  return token ? verifySession(token) : null;
}
