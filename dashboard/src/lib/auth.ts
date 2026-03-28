import { NextRequest } from 'next/server';
import { UnauthorizedError } from './errors';
import { logger } from './logger';

/**
 * Centralised authentication utilities for Mission Control.
 *
 * Session format (HMAC-SHA256 signed, base64-encoded):
 *   { payloadB64 }.{ signatureHex }
 *
 * Payload: { userId, role, exp }
 */

// ── Session types ────────────────────────────────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET;
const AGENT_API_KEY = process.env.AGENT_API_KEY;

export interface SessionUser {
  userId: string;
  role: string;
  exp: number;
}

// ── HMAC verification ────────────────────────────────────────────────────────────

async function computeHmac(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Session verification ────────────────────────────────────────────────────────

/**
 * Verifies the session cookie or agent API key from a Next.js request.
 * Returns the session user if valid, null otherwise.
 */
export async function verifySession(request: NextRequest): Promise<SessionUser | null> {
  if (!SESSION_SECRET) {
    logger.fatal({ event: 'auth_missing_secret' }, 'SESSION_SECRET is not configured — requests will be rejected');
    return null;
  }

  // Agent API key — only if explicitly configured (no fallback)
  if (AGENT_API_KEY) {
    const apiKey = request.headers.get('x-agent-key');
    if (apiKey === AGENT_API_KEY) {
      return { userId: 'agent', role: 'agent', exp: Date.now() + 86400000 };
    }
  }

  const session = request.cookies.get('lex-session')?.value;
  if (!session) return null;

  try {
    const [payloadB64, sig] = session.split('.');
    if (!payloadB64 || !sig) return null;

    const payload = atob(payloadB64);
    const expected = await computeHmac(payload, SESSION_SECRET);

    if (sig !== expected) return null;

    const data = JSON.parse(payload) as SessionUser;
    if (data.exp < Date.now()) return null;

    return data;
  } catch {
    return null;
  }
}

/**
 * Like verifySession but throws UnauthorizedError if no valid session is found.
 * Use this in route handlers that must have an authenticated user.
 *
 * Example:
 *   const session = await requireAuth(request);
 */
export async function requireAuth(request: NextRequest): Promise<SessionUser> {
  const session = await verifySession(request);
  if (!session) {
    throw new UnauthorizedError();
  }
  return session;
}
