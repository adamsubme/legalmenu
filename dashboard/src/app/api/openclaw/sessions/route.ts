import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { queryAll } from '@/lib/db';
import { parseRequest, createOpenClawSessionSchema } from '@/lib/validation';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';
import type { OpenClawSession } from '@/lib/types';

// GET /api/openclaw/sessions - List OpenClaw sessions
export async function GET(request: NextRequest) {
  try {
    await requireOpenClawAuth(request);
    const { searchParams } = new URL(request.url);
    const sessionType = searchParams.get('session_type');
    const status = searchParams.get('status');

    if (sessionType || status) {
      let sql = 'SELECT * FROM openclaw_sessions WHERE 1=1';
      const params: unknown[] = [];

      if (sessionType) {
        sql += ' AND session_type = ?';
        params.push(sessionType);
      }
      if (status) {
        sql += ' AND status = ?';
        params.push(status);
      }

      sql += ' ORDER BY created_at DESC';

      const sessions = queryAll<OpenClawSession>(sql, params);
      return NextResponse.json(sessions);
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

    const sessions = await client.listSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// POST /api/openclaw/sessions - Create a new OpenClaw session
export async function POST(request: NextRequest) {
  try {
    await requireOpenClawAuth(request);
    const body = await parseRequest(request, createOpenClawSessionSchema);

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

    const session = await client.createSession(body.channel, body.peer);
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return mapOpenClawError(error);
  }
}
