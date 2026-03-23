import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const ADMIN_USER = process.env.AUTH_USERNAME || 'Admin';
const ADMIN_PASS = process.env.AUTH_PASSWORD || 'Mica#3000';
const SESSION_SECRET = process.env.SESSION_SECRET || 'lex-legal-session-secret-2026-v3';

function createToken(username: string): string {
  const payload = JSON.stringify({ user: username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const hmac = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  const payloadB64 = Buffer.from(payload).toString('base64');
  return payloadB64 + '.' + hmac;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { username, password } = body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = createToken(username);
    const response = NextResponse.json({ success: true });
    response.cookies.set('lex-session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
    return response;
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}
