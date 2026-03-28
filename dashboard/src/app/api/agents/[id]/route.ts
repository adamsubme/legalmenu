import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { parseRequest, updateAgentSchema } from '@/lib/validation';
import type { Agent } from '@/lib/types';
import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

const WORKSPACE_ROOT = process.env.VENTURE_STUDIO_PATH || join(process.cwd(), '..', 'venture-studio');

const AGENT_WORKSPACE_MAP: Record<string, string> = {
  'Bull': 'workspace',
  'Eagle': 'workspace-strateg',
  'Wolf': 'workspace-bd',
  'Cheetah': 'workspace-cmo',
  'Fox (Ziutek)': 'workspace-ziutek',
  'Owl': 'workspace-hr',
  'Lynx': 'workspace-cfo',
  'Beaver': 'workspace-cpo',
};

function syncToFilesystem(agentName: string, field: string, content: string) {
  const wsDir = AGENT_WORKSPACE_MAP[agentName];
  if (!wsDir) return;
  
  const fileMap: Record<string, string> = {
    'soul_md': 'SOUL.md',
    'user_md': 'USER.md',
    'agents_md': 'AGENTS.md',
    'heartbeat_md': 'HEARTBEAT.md',
  };
  
  const filename = fileMap[field];
  if (!filename) return;
  
  const dirPath = join(WORKSPACE_ROOT, wsDir);
  const filePath = join(dirPath, filename);
  
  if (existsSync(dirPath)) {
    writeFileSync(filePath, content, 'utf-8');
    logger.info({ event: 'agent_file_synced', path: filePath, size: content.length });
  }
}

// GET /api/agents/[id] - Get a single agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    logger.error({ event: 'agent_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch agent') }, { status: 500 });
  }
}

// PATCH /api/agents/[id] - Update an agent
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await parseRequest(request, updateAgentSchema);

    const existing = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name);
    }
    if (body.role !== undefined) {
      updates.push('role = ?');
      values.push(body.role);
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      values.push(body.description);
    }
    if (body.avatar_emoji !== undefined) {
      updates.push('avatar_emoji = ?');
      values.push(body.avatar_emoji);
    }
    if (body.status !== undefined) {
      updates.push('status = ?');
      values.push(body.status);

      const now = new Date().toISOString();
      run(
        `INSERT INTO events (id, type, agent_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), 'agent_status_changed', id, `${existing.name} is now ${body.status}`, now]
      );
    }
    if (body.is_master !== undefined) {
      updates.push('is_master = ?');
      values.push(body.is_master ? 1 : 0);
    }
    if (body.soul_md !== undefined) {
      updates.push('soul_md = ?');
      values.push(body.soul_md);
    }
    if (body.user_md !== undefined) {
      updates.push('user_md = ?');
      values.push(body.user_md);
    }
    if (body.agents_md !== undefined) {
      updates.push('agents_md = ?');
      values.push(body.agents_md);
    }
    if (body.heartbeat_md !== undefined) {
      updates.push('heartbeat_md = ?');
      values.push(body.heartbeat_md);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    run(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, values);

    const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);

    if (agent) {
      const mdFields = ['soul_md', 'user_md', 'agents_md', 'heartbeat_md'] as const;
      for (const field of mdFields) {
        if ((body as Record<string, unknown>)[field] !== undefined) {
          syncToFilesystem(agent.name, field, (body as Record<string, unknown>)[field] as string);
        }
      }
    }

    return NextResponse.json(agent);
  } catch (error) {
    logger.error({ event: 'agent_update_failed' }, error);
    return NextResponse.json({ error: api.internalError('update agent') }, { status: 500 });
  }
}

// DELETE /api/agents/[id] - Delete an agent
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);

    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Delete or nullify related records first (foreign key constraints)
    run('DELETE FROM openclaw_sessions WHERE agent_id = ?', [id]);
    run('DELETE FROM events WHERE agent_id = ?', [id]);
    run('DELETE FROM messages WHERE sender_agent_id = ?', [id]);
    run('DELETE FROM conversation_participants WHERE agent_id = ?', [id]);
    run('UPDATE tasks SET assigned_agent_id = NULL WHERE assigned_agent_id = ?', [id]);
    run('UPDATE tasks SET created_by_agent_id = NULL WHERE created_by_agent_id = ?', [id]);
    run('UPDATE task_activities SET agent_id = NULL WHERE agent_id = ?', [id]);

    // Now delete the agent
    run('DELETE FROM agents WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ event: 'agent_delete_failed' }, error);
    return NextResponse.json({ error: api.internalError('delete agent') }, { status: 500 });
  }
}
