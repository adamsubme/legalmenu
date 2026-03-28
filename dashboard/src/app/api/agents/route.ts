import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { parseRequest, createAgentSchema } from '@/lib/validation';
import type { Agent } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

// GET /api/agents - List all agents
export async function GET(request: NextRequest) {
  try {
    const workspaceId = request.nextUrl.searchParams.get('workspace_id');

    let agents: Agent[];
    if (workspaceId) {
      agents = queryAll<Agent>(
        `SELECT * FROM agents WHERE workspace_id = ? ORDER BY is_master DESC, name ASC`,
        [workspaceId]
      );
    } else {
      agents = queryAll<Agent>(
        `SELECT * FROM agents ORDER BY is_master DESC, name ASC`
      );
    }
    return NextResponse.json(agents);
  } catch (error) {
    logger.error({ event: 'agents_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch agents') }, { status: 500 });
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createAgentSchema);

    const id = uuidv4();
    const now = new Date().toISOString();

    run(
      `INSERT INTO agents
         (id, name, role, description, avatar_emoji, is_master, workspace_id,
          soul_md, user_md, agents_md, heartbeat_md, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.name,
        body.role,
        body.description || null,
        body.avatar_emoji || '🤖',
        body.is_master ? 1 : 0,
        body.workspace_id || 'default',
        body.soul_md || null,
        body.user_md || null,
        body.agents_md || null,
        body.heartbeat_md || null,
        now,
        now,
      ]
    );

    run(
      `INSERT INTO events (id, type, agent_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), 'agent_joined', id, `${body.name} joined the team`, now]
    );

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ValidationError') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    logger.error({ event: 'agent_create_failed' }, error);
    return NextResponse.json({ error: api.internalError('create agent') }, { status: 500 });
  }
}
