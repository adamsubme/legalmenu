import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';

export const dynamic = 'force-dynamic';

// GET /api/openclaw/status - Check OpenClaw connection status
export async function GET(request: NextRequest) {
  try {
    await requireOpenClawAuth(request);
    const client = getOpenClawClient();

    if (!client.isConnected()) {
      try {
        await client.connect();
      } catch {
        return NextResponse.json({
          connected: false,
          error: 'Failed to connect to OpenClaw Gateway',
          gateway_url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
        });
      }
    }

    try {
      const sessions = await client.listSessions();
      return NextResponse.json({
        connected:       true,
        sessions_count:  sessions.length,
        sessions,
        gateway_url:     process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
      });
    } catch {
      return NextResponse.json({
        connected:   true,
        error:       'Connected but failed to list sessions',
        gateway_url: process.env.OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
      });
    }
  } catch (error) {
    return mapOpenClawError(error);
  }
}
