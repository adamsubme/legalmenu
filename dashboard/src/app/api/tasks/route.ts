import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { run, queryOne } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { dispatchTask } from '@/lib/dispatch';
import { listTasks, getTaskById } from '@/lib/db/queries';
import { parseRequest, createTaskSchema } from '@/lib/validation';
import { NotFoundError, InternalError } from '@/lib/errors';
import type { Agent } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tasks = listTasks({
      status: searchParams.get('status') ?? undefined,
      businessId: searchParams.get('business_id') ?? undefined,
      workspaceId: searchParams.get('workspace_id') ?? undefined,
      assignedAgentId: searchParams.get('assigned_agent_id') ?? undefined,
      limit: parseInt(searchParams.get('limit') ?? '200', 10) || 200,
      offset: parseInt(searchParams.get('offset') ?? '0', 10) || 0,
    });

    return NextResponse.json({ items: tasks, count: tasks.length });
  } catch (error) {
    logger.error({ event: 'tasks_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch tasks') }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await parseRequest(request, createTaskSchema);
    const id = uuidv4();
    const now = new Date().toISOString();

    // Default to Lex COO if no assignee
    let assignedAgentId: string | null = body.assigned_agent_id ?? null;
    if (!assignedAgentId) {
      const lexCoo = queryOne<Agent>('SELECT id FROM agents WHERE name = ?', ['Lex COO']);
      if (lexCoo) assignedAgentId = lexCoo.id;
    }

    run(
      `INSERT INTO tasks
         (id, title, description, status, priority, assigned_agent_id, created_by_agent_id,
          workspace_id, business_id, due_date, client_id, project_id,
          planning_complete, planning_messages, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '[]', 'mc', ?, ?)`,
      [
        id,
        body.title,
        body.description ?? null,
        body.status ?? 'not_started',
        body.priority ?? 'normal',
        assignedAgentId,
        body.created_by_agent_id ?? null,
        body.business_id ?? 'default',
        body.due_date ?? null,
        body.client_id ?? null,
        body.project_id ?? null,
        now,
        now,
      ]
    );

    // Log event
    const creator = body.created_by_agent_id
      ? queryOne<Agent>('SELECT name FROM agents WHERE id = ?', [body.created_by_agent_id])
      : null;
    const eventMessage = creator
      ? `${creator.name} created task: ${body.title}`
      : `New task: ${body.title}`;

    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'task_created', body.created_by_agent_id ?? null, id, eventMessage, now]
    );

    // Fetch created task
    let task = getTaskById(id);

    // Broadcast task creation via SSE
    if (task) {
      broadcast({ type: 'task_created', payload: task });
    }

    // Auto-dispatch when assigned
    let dispatchResult: { success: boolean; error?: string } | null = null;
    if (assignedAgentId) {
      dispatchResult = await dispatchTask(id);
      if (!dispatchResult.success) {
        logger.error({ event: 'task_auto_dispatch_failed', taskId: id, error: dispatchResult.error });
        run(
          `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [uuidv4(), 'dispatch_failed', null, id, `Dispatch failed: ${dispatchResult.error}`, now]
        );
        broadcast({
          type: 'event_added',
          payload: {
            id: uuidv4(), type: 'dispatch_failed', task_id: id,
            message: `Dispatch failed: ${dispatchResult.error}`, created_at: now,
          },
        });
      } else {
        // Re-fetch after status change to in_progress
        task = getTaskById(id) ?? task;
      }
    }

    return NextResponse.json(
      {
        ...task,
        dispatch_ok: dispatchResult?.success ?? null,
        dispatch_error: dispatchResult?.error,
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ event: 'task_create_failed' }, error);
    return NextResponse.json({ error: api.internalError('create task') }, { status: 500 });
  }
}
