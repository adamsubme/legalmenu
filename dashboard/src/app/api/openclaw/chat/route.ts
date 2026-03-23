import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

// GET /api/openclaw/chat?sessionKey=agent:bull:main&limit=100
export async function GET(request: NextRequest) {
  try {
    const sessionKey = request.nextUrl.searchParams.get('sessionKey');
    const limit = Math.min(500, parseInt(request.nextUrl.searchParams.get('limit') || '100', 10) || 100);

    if (!sessionKey) {
      return NextResponse.json({ error: 'sessionKey is required' }, { status: 400 });
    }

    const client = getOpenClawClient();

    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json(
          { error: 'Failed to connect to OpenClaw Gateway' },
          { status: 503 }
        );
      }
    }

    const messages = await client.getChatHistory(sessionKey, limit);
    return NextResponse.json({ sessionKey, messages });
  } catch (error) {
    console.error('Failed to get chat history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
