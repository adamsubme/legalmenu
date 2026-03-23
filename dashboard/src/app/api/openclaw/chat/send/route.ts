/**
 * POST /api/openclaw/chat/send
 * Send a message to an agent via OpenClaw
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

export async function POST(request: NextRequest) {
  try {
    const { sessionKey, message } = await request.json();

    if (!sessionKey || !message) {
      return NextResponse.json({ error: 'sessionKey and message are required' }, { status: 400 });
    }

    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json({ error: 'Failed to connect to OpenClaw Gateway' }, { status: 503 });
      }
    }

    await client.call('chat.send', {
      sessionKey,
      message,
      idempotencyKey: `mc-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
