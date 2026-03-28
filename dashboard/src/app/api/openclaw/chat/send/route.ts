/**
 * POST /api/openclaw/chat/send
 * Send a message to an agent via OpenClaw
 */
import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { parseRequest, sendOpenClawMessageSchema } from '@/lib/validation';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';

export async function POST(request: NextRequest) {
  try {
    await requireOpenClawAuth(request);
    const body = await parseRequest(request, sendOpenClawMessageSchema);

    const client = getOpenClawClient();
    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json({ error: 'Failed to connect to OpenClaw Gateway' }, { status: 503 });
      }
    }

    await client.call('chat.send', {
      sessionKey:     body.sessionKey,
      message:        body.message,
      idempotencyKey: `mc-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return mapOpenClawError(error);
  }
}
