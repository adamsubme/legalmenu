import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { parseRequest, createSessionMessageSchema } from '@/lib/validation';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/openclaw/sessions/[id]/history - Get conversation history
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(_request);
    const { id } = await params;
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

    const sessionsResponse = (await client.listSessions()) as {
      sessions?: Array<{ sessionId?: string; key?: string }>;
    };
    const sessions = sessionsResponse.sessions || [];
    const session = sessions.find(s => s.sessionId === id || s.key === id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const sessionKey = session.key || id;
    const history = await client.getChatHistory(sessionKey);
    return NextResponse.json(history);
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// POST /api/openclaw/sessions/[id]/history - Send message to session
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(request);
    const { id } = await params;
    const body = await parseRequest(request, createSessionMessageSchema);

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

    const sessionsResponse = (await client.listSessions()) as {
      sessions?: Array<{ sessionId?: string; key?: string }>;
    };
    const sessions = sessionsResponse.sessions || [];
    const session = sessions.find(s => s.sessionId === id || s.key === id);
    const key = body.sessionKey || session?.key || id;

    await client.sendMessage(key, body.content);
    return NextResponse.json({ success: true });
  } catch (error) {
    return mapOpenClawError(error);
  }
}
