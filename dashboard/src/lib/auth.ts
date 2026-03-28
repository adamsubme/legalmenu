import { NextRequest, NextResponse } from 'next/server';

const SESSION_SECRET = process.env.SESSION_SECRET || 'lex-legal-session-secret-2026-v3';

export interface SessionUser {
  userId: string;
  role: string;
  exp: number;
}

export async function verifySession(request: NextRequest): Promise<SessionUser | null> {
  const session = request.cookies.get('lex-session')?.value;
  if (!session) return null;

  try {
    const [payloadB64, sig] = session.split('.');
    if (!payloadB64 || !sig) return null;

    const payload = atob(payloadB64);

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SESSION_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expected = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (sig !== expected) return null;
    const data = JSON.parse(payload) as SessionUser;

    if (data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function requireAuth(request: NextRequest): Promise<SessionUser> {
  const session = await verifySession(request);
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}
