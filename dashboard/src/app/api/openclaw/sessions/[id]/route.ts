import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { getDb } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { parseRequest, createSessionMessageSchema, updateSessionSchema } from '@/lib/validation';
import { requireOpenClawAuth, mapOpenClawError } from '@/lib/openclaw/auth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/openclaw/sessions/[id] - Get session details
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

    const sessions = await client.listSessions();
    const session = sessions.find((s) => s.id === id);

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ session });
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// POST /api/openclaw/sessions/[id] - Send a message to the session
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

    const prefixedContent = `[Mission Control] ${body.content}`;
    await client.sendMessage(id, prefixedContent);

    return NextResponse.json({ success: true });
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// PATCH /api/openclaw/sessions/[id] - Update session status (for completing sub-agents)
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(request);
    const { id } = await params;
    const body = await parseRequest(request, updateSessionSchema);

    const db = getDb();

    const session = db
      .prepare('SELECT * FROM openclaw_sessions WHERE openclaw_session_id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found in database' },
        { status: 404 }
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);
    }
    if (body.ended_at !== undefined) {
      updates.push('ended_at = ?');
      values.push(body.ended_at);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(session.id as string);

    db.prepare(`UPDATE openclaw_sessions SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const updatedSession = db
      .prepare('SELECT * FROM openclaw_sessions WHERE id = ?')
      .get(session.id as string);

    if (body.status === 'completed') {
      if (session.agent_id) {
        db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('idle', session.agent_id);
      }
      if (session.task_id) {
        broadcast({
          type: 'agent_completed',
          payload: {
            taskId: session.task_id as string,
            sessionId: id,
          },
        });
      }
    }

    return NextResponse.json(updatedSession);
  } catch (error) {
    return mapOpenClawError(error);
  }
}

// DELETE /api/openclaw/sessions/[id] - Delete a session and its associated agent
export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams
) {
  try {
    await requireOpenClawAuth(_request);
    const { id } = await params;
    const db = getDb();

    let session = db
      .prepare('SELECT * FROM openclaw_sessions WHERE openclaw_session_id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!session) {
      session = db
        .prepare('SELECT * FROM openclaw_sessions WHERE id = ?')
        .get(id) as Record<string, unknown> | undefined;
    }

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const taskId = session.task_id as string | null;
    const agentId = session.agent_id as string | null;

    db.prepare('DELETE FROM openclaw_sessions WHERE id = ?').run(session.id as string);

    if (agentId) {
      const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as Record<string, unknown> | undefined;
      if (agent) {
        if ((agent.role as string) === 'Sub-Agent') {
          db.prepare('DELETE FROM agents WHERE id = ?').run(agentId);
        } else {
          db.prepare('UPDATE agents SET status = ? WHERE id = ?').run('idle', agentId);
        }
      }
    }

    broadcast({
      type: 'agent_completed',
      payload: { taskId: taskId ?? '', sessionId: id, deleted: true },
    });

    return NextResponse.json({ success: true, deleted: session.id });
  } catch (error) {
    return mapOpenClawError(error);
  }
}
