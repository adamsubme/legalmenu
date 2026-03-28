import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/openclaw/sessions/[id]/history - Get conversation history
export async function GET(request: Request, { params }: RouteParams) {
  try {
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

    // First get the session to find its key
    const sessions = await client.listSessions() as Array<{ sessionId?: string; key?: string; [key: string]: unknown }>;
    const session = sessions.find(s => s.sessionId === id || s.key === id);
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Use getChatHistory with the session key
    const history = await client.getChatHistory(session.key || id);
    return NextResponse.json(history);
  } catch (error) {
    console.error('Failed to get OpenClaw session history:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/openclaw/sessions/[id]/history - Send message to session
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, sessionKey } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
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

    // Find session to get its key
    const sessions = await client.listSessions();
    const session = sessions.find((s: { sessionId: string; key?: string }) => s.sessionId === id);
    const key = sessionKey || session?.key || id;

    // Use sendMessage to send to the session
    await client.sendMessage(key, content);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to send message:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
