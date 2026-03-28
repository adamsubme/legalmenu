/**
 * Task route handlers — shared between /api/v1/tasks and /api/tasks.
 *
 * These are pure functions that return plain objects.
 * The route files wrap them with version-specific middleware
 * (v1Handler for v1, deprecatedHandler for legacy).
 *
 * DO NOT import NextRequest or NextResponse here.
 */

import { v4 as uuidv4 } from 'uuid';
import { run, queryOne } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { dispatchTask } from '@/lib/dispatch';
import { getMissionControlUrl } from '@/lib/config';
import { listTasks, getTaskById } from '@/lib/db/queries';
import { logger } from '@/lib/logger';
import type { Agent } from '@/lib/types';

// ── List ──────────────────────────────────────────────────────────────────────

export interface ListTasksOptions {
  status?: string | null;
  businessId?: string | null;
  workspaceId?: string | null;
  assignedAgentId?: string | null;
  limit?: number;
  offset?: number;
}

export function listTasksHandler(opts: ListTasksOptions) {
  const tasks = listTasks({
    status:        opts.status ?? undefined,
    businessId:   opts.businessId ?? undefined,
    workspaceId:   opts.workspaceId ?? undefined,
    assignedAgentId: opts.assignedAgentId ?? undefined,
    limit:        Math.min(opts.limit ?? 200, 200),
    offset:       opts.offset ?? 0,
  });
  return { items: tasks, count: tasks.length };
}

// ── Get one ────────────────────────────────────────────────────────────────────

export function getTaskHandler(id: string) {
  const task = getTaskById(id);
  if (!task) {
    return { error: `Task ${id} not found`, status: 404 as const };
  }
  return { data: task };
}

// ── Create ─────────────────────────────────────────────────────────────────────

export interface CreateTaskBody {
  title: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigned_agent_id?: string | null;
  created_by_agent_id?: string | null;
  business_id?: string;
  due_date?: string | null;
  client_id?: string | null;
  project_id?: string | null;
}

export async function createTaskHandler(body: CreateTaskBody) {
  const id = uuidv4();
  const now = new Date().toISOString();

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

  let task = getTaskById(id);

  if (task) {
    broadcast({ type: 'task_created', payload: task });
  }

  let dispatchResult: { success: boolean; error?: string } | null = null;

  if (assignedAgentId) {
    dispatchResult = await dispatchTask(id);
    if (!dispatchResult.success) {
      logger.error({ event: 'task_auto_dispatch_failed', taskId: id }, dispatchResult.error);
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
      task = getTaskById(id) ?? task;
    }
  }

  return {
    data: {
      ...task,
      dispatch_ok: dispatchResult?.success ?? null,
      dispatch_error: dispatchResult?.error,
    },
    status: 201 as const,
  };
}

// ── Update ─────────────────────────────────────────────────────────────────────

export interface UpdateTaskBody {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  assigned_agent_id?: string | null;
  created_by_agent_id?: string | null;
  business_id?: string;
  due_date?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  notion_page_id?: string | null;
  sub_status?: string;
  updated_by_agent_id?: string | null;
}

export async function updateTaskHandler(id: string, body: UpdateTaskBody) {
  const existing = getTaskById(id);
  if (!existing) {
    return { error: `Task ${id} not found`, status: 404 as const };
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  const now = new Date().toISOString();

  if (body.title !== undefined) {
    updates.push('title = ?');
    values.push(body.title);
  }
  if (body.description !== undefined) {
    updates.push('description = ?');
    values.push(body.description);
  }
  if (body.sub_status !== undefined) {
    updates.push('sub_status = ?');
    values.push(body.sub_status);
  }
  if (body.priority !== undefined) {
    updates.push('priority = ?');
    values.push(body.priority);
  }
  if (body.due_date !== undefined) {
    updates.push('due_date = ?');
    values.push(body.due_date);
  }
  if (body.client_id !== undefined) {
    updates.push('client_id = ?');
    values.push(body.client_id);
  }
  if (body.project_id !== undefined) {
    updates.push('project_id = ?');
    values.push(body.project_id);
  }

  let shouldDispatch = false;

  if (body.status !== undefined && body.status !== existing.status) {
    updates.push('status = ?');
    values.push(body.status);

    const eventType = body.status === 'done' ? 'task_completed' : 'task_status_changed';
    run(
      `INSERT INTO events (id, type, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [uuidv4(), eventType, id, `Task "${existing.title}" moved to ${body.status}`, now]
    );

    if (body.status === 'in_progress' && existing.assigned_agent_id) {
      shouldDispatch = true;
    }
  }

  if (
    body.assigned_agent_id !== undefined &&
    body.assigned_agent_id !== existing.assigned_agent_id
  ) {
    updates.push('assigned_agent_id = ?');
    values.push(body.assigned_agent_id);

    if (body.assigned_agent_id) {
      const agent = queryOne<Agent>(
        'SELECT name FROM agents WHERE id = ?',
        [body.assigned_agent_id]
      );
      if (agent) {
        run(
          `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            'task_assigned',
            body.assigned_agent_id,
            id,
            `"${existing.title}" assigned to ${agent.name}`,
            now,
          ]
        );
        if (existing.status === 'in_progress' || body.status === 'in_progress') {
          shouldDispatch = true;
        }
      }
    }
  }

  if (updates.length === 0) {
    return { error: 'No updates provided', status: 400 as const };
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

  const updatedTask = getTaskById(id);
  if (updatedTask) {
    broadcast({ type: 'task_updated', payload: updatedTask });
  }

  // Notion sync
  if (existing.notion_page_id) {
    const { updateNotionTask } = await import('@/lib/notion/client');
    const notionUpdates: Record<string, unknown> = {};
    if (body.title !== undefined) notionUpdates.title = body.title;
    if (body.status !== undefined) notionUpdates.status = body.status;
    if (body.priority !== undefined) notionUpdates.priority = body.priority;
    if (body.description !== undefined) notionUpdates.description = body.description;
    if (body.due_date !== undefined) notionUpdates.due_date = body.due_date;
    if (body.assigned_agent_id && typeof body.assigned_agent_id === 'string') {
      const agn = queryOne<Agent>('SELECT name FROM agents WHERE id = ?', [body.assigned_agent_id]);
      if (agn) notionUpdates.ai_assignee = agn.name;
    }

    updateNotionTask(existing.notion_page_id, notionUpdates as Parameters<typeof updateNotionTask>[1])
      .then(() => {
        run('UPDATE tasks SET notion_last_synced = ? WHERE id = ?', [new Date().toISOString(), id]);
        logger.info({ event: 'notion_task_synced', taskId: id, title: existing.title });
      })
      .catch((err) => {
        logger.error({ event: 'notion_sync_failed', taskId: id, title: existing.title }, err);
      });
  }

  // Auto-dispatch
  if (shouldDispatch) {
    const missionControlUrl = getMissionControlUrl();
    fetch(`${missionControlUrl}/api/tasks/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch((err) => {
      logger.error({ event: 'task_update_auto_dispatch_failed', taskId: id }, err);
    });
  }

  return { data: updatedTask ?? { id } };
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export function deleteTaskHandler(id: string) {
  const existing = getTaskById(id);
  if (!existing) {
    return { error: `Task ${id} not found`, status: 404 as const };
  }

  run('DELETE FROM openclaw_sessions WHERE task_id = ?', [id]);
  run('DELETE FROM events WHERE task_id = ?', [id]);
  run('UPDATE conversations SET task_id = NULL WHERE task_id = ?', [id]);
  run('DELETE FROM tasks WHERE id = ?', [id]);

  broadcast({ type: 'task_deleted', payload: { id } });

  return { data: { success: true } };
}
