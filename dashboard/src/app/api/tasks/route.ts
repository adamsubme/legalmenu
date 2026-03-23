import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { dispatchTask } from '@/lib/dispatch';
import type { Task, CreateTaskRequest, Agent } from '@/lib/types';

// GET /api/tasks - List all tasks with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const businessId = searchParams.get('business_id');
    const workspaceId = searchParams.get('workspace_id');
    const assignedAgentId = searchParams.get('assigned_agent_id');

    let sql = `
      SELECT
        t.*,
        aa.name as assigned_agent_name,
        aa.avatar_emoji as assigned_agent_emoji,
        ca.name as created_by_agent_name
      FROM tasks t
      LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
      LEFT JOIN agents ca ON t.created_by_agent_id = ca.id
      WHERE (t.source = 'mc' OR t.source IS NULL)
    `;
    const params: unknown[] = [];

    if (status) {
      // Support comma-separated status values (e.g., status=inbox,testing,in_progress)
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      if (statuses.length === 1) {
        sql += ' AND t.status = ?';
        params.push(statuses[0]);
      } else if (statuses.length > 1) {
        sql += ` AND t.status IN (${statuses.map(() => '?').join(',')})`;
        params.push(...statuses);
      }
    }
    if (businessId) {
      sql += ' AND t.business_id = ?';
      params.push(businessId);
    }
    if (workspaceId) {
      sql += ' AND t.workspace_id = ?';
      params.push(workspaceId);
    }
    if (assignedAgentId) {
      sql += ' AND t.assigned_agent_id = ?';
      params.push(assignedAgentId);
    }

    sql += ' ORDER BY t.created_at DESC';

    const tasks = queryAll<Task & { assigned_agent_name?: string; assigned_agent_emoji?: string; created_by_agent_name?: string }>(sql, params);

    // Transform to include nested agent info
    const transformedTasks = tasks.map((task) => ({
      ...task,
      assigned_agent: task.assigned_agent_id
        ? {
            id: task.assigned_agent_id,
            name: task.assigned_agent_name,
            avatar_emoji: task.assigned_agent_emoji,
          }
        : undefined,
    }));

    return NextResponse.json(transformedTasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body: CreateTaskRequest = await request.json();
    console.log('[POST /api/tasks] Received body:', JSON.stringify(body));

    if (!body.title) {
      console.log('[POST /api/tasks] Title missing or empty');
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const workspaceId = (body as { workspace_id?: string }).workspace_id || 'default';
    const status = (body as { status?: string }).status || 'not_started';

    // Default to Lex COO if no assignee
    let assignedAgentId = body.assigned_agent_id || null;
    if (!assignedAgentId) {
      const bull = queryOne<Agent>('SELECT id FROM agents WHERE name = ?', ['Lex COO']);
      if (bull) assignedAgentId = bull.id;
    }

    run(
      `INSERT INTO tasks (id, title, description, status, priority, assigned_agent_id, created_by_agent_id, workspace_id, business_id, due_date, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'mc', ?, ?)`,
      [
        id,
        body.title,
        body.description || null,
        status,
        body.priority || 'normal',
        assignedAgentId,
        body.created_by_agent_id || null,
        workspaceId,
        body.business_id || 'default',
        body.due_date || null,
        now,
        now,
      ]
    );

    // Log event
    let eventMessage = `New task: ${body.title}`;
    if (body.created_by_agent_id) {
      const creator = queryOne<Agent>('SELECT name FROM agents WHERE id = ?', [body.created_by_agent_id]);
      if (creator) {
        eventMessage = `${creator.name} created task: ${body.title}`;
      }
    }

    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'task_created', body.created_by_agent_id || null, id, eventMessage, now]
    );

    // Fetch created task with all joined fields
    let task = queryOne<Task & { assigned_agent_name?: string; assigned_agent_emoji?: string }>(
      `SELECT t.*,
        aa.name as assigned_agent_name,
        aa.avatar_emoji as assigned_agent_emoji,
        ca.name as created_by_agent_name,
        ca.avatar_emoji as created_by_agent_emoji
       FROM tasks t
       LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
       LEFT JOIN agents ca ON t.created_by_agent_id = ca.id
       WHERE t.id = ?`,
      [id]
    );
    
    // Broadcast task creation via SSE
    if (task) {
      broadcast({
        type: 'task_created',
        payload: task,
      });
    }

    // Auto-dispatch when assigned – await so we can report errors
    let dispatchResult: { success: boolean; error?: string } | null = null;
    if (assignedAgentId) {
      dispatchResult = await dispatchTask(id);
      if (!dispatchResult.success) {
        console.error('[POST /api/tasks] Auto-dispatch failed:', dispatchResult.error);
        const eventId = uuidv4();
        run(
          `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [eventId, 'dispatch_failed', null, id, `Dispatch failed: ${dispatchResult.error}`, now]
        );
        broadcast({
          type: 'event_added',
          payload: { id: eventId, type: 'dispatch_failed', task_id: id, message: `Dispatch failed: ${dispatchResult.error}`, created_at: now },
        });
      } else {
        // Re-fetch task (status changed to in_progress) for response
        const updated = queryOne<Task & { assigned_agent_name?: string; assigned_agent_emoji?: string; created_by_agent_name?: string; created_by_agent_emoji?: string }>(
          `SELECT t.*, aa.name as assigned_agent_name, aa.avatar_emoji as assigned_agent_emoji,
            ca.name as created_by_agent_name, ca.avatar_emoji as created_by_agent_emoji
           FROM tasks t
           LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
           LEFT JOIN agents ca ON t.created_by_agent_id = ca.id
           WHERE t.id = ?`,
          [id]
        );
        if (updated) task = updated;
      }
    }

    const responseTask = {
      ...task,
      assigned_agent: task?.assigned_agent_id
        ? { id: task.assigned_agent_id, name: task.assigned_agent_name, avatar_emoji: task.assigned_agent_emoji }
        : undefined,
    };
    return NextResponse.json(
      { ...responseTask, dispatch_ok: dispatchResult?.success ?? null, dispatch_error: dispatchResult?.error },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
