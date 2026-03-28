import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';
import type { Agent, OpenClawSession } from '@/lib/types';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/agents/[id]/openclaw - Get the agent's OpenClaw session
export async function GET(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(_request);
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [id, 'active']
    );

    if (!session) {
      return NextResponse.json({ linked: false, session: null });
    }

    return NextResponse.json({ linked: true, session });
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// POST /api/agents/[id]/openclaw - Link agent to OpenClaw (creates session)
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(request);
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const existingSession = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [id, 'active']
    );
    if (existingSession) {
      return NextResponse.json(
        { error: 'Agent is already linked to an OpenClaw session', session: existingSession },
        { status: 409 }
      );
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

    try {
      await client.listSessions();
    } catch (err) {
      logger.error({ event: 'openclaw_connection_verify_failed' }, err);
      return NextResponse.json(
        { error: 'Connected but failed to communicate with OpenClaw Gateway' },
        { status: 503 }
      );
    }

    const sessionId = uuidv4();
    const openclawSessionId = `mission-control-${agent.name.toLowerCase().replace(/\s+/g, '-')}`;
    const now = new Date().toISOString();

    run(
      `INSERT INTO openclaw_sessions
         (id, agent_id, openclaw_session_id, channel, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, id, openclawSessionId, 'mission-control', 'active', now, now]
    );

    run(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'agent_status_changed', id, `${agent.name} connected to OpenClaw Gateway`, now]
    );

    const session = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE id = ?',
      [sessionId]
    );

    return NextResponse.json({ linked: true, session }, { status: 201 });
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// DELETE /api/agents/[id]/openclaw - Unlink agent from OpenClaw
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(_request);
    const { id } = await params;

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const existingSession = queryOne<OpenClawSession>(
      'SELECT * FROM openclaw_sessions WHERE agent_id = ? AND status = ?',
      [id, 'active']
    );

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Agent is not linked to an OpenClaw session' },
        { status: 404 }
      );
    }

    const now = new Date().toISOString();
    run(
      'UPDATE openclaw_sessions SET status = ?, updated_at = ? WHERE id = ?',
      ['inactive', now, existingSession.id]
    );

    run(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'agent_status_changed', id, `${agent.name} disconnected from OpenClaw Gateway`, now]
    );

    return NextResponse.json({ linked: false, success: true });
  } catch (error) {
    return mapOpenClawError(error);
  }
}
