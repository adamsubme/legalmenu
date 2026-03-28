import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { run, queryOne } from '@/lib/db';
import { broadcast } from '@/lib/events';
import { getMissionControlUrl } from '@/lib/config';
import { getTaskById } from '@/lib/db/queries';
import { parseRequest, updateTaskSchema } from '@/lib/validation';
import { WorkflowError } from '@/lib/errors';
import { enforceTransition, isValidStatus, type TaskStatus } from '@/lib/workflow';
import type { Agent } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const task = getTaskById(id);

    if (!task) {
      return NextResponse.json(
        { error: `Task ${id} not found`, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    logger.error({ event: 'task_fetch_failed' }, error);
    return NextResponse.json({ error: api.internalError('fetch task') }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let taskId: string;

  try {
    taskId = (await params).id;
  } catch {
    return NextResponse.json({ error: 'Invalid route parameters' }, { status: 400 });
  }

  try {
    const body = await parseRequest(request, updateTaskSchema);

    const existing = getTaskById(taskId);
    if (!existing) {
      return NextResponse.json(
        { error: `Task ${taskId} not found`, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // ── Validate existing status ─────────────────────────────────────────────
    if (!isValidStatus(existing.status)) {
      logger.error({ event: 'task_invalid_status', taskId, status: existing.status });
      return NextResponse.json(
        { error: `Task has invalid status "${existing.status}"`, code: 'INVALID_STATUS' },
        { status: 422 }
      );
    }

    // ── Workflow transition guard ───────────────────────────────────────────
    if (body.status !== undefined && body.status !== existing.status) {
      let actor: { id: string; is_master?: boolean } | undefined;

      if (body.updated_by_agent_id) {
        const agent = queryOne<Agent>(
          'SELECT id, is_master FROM agents WHERE id = ?',
          [body.updated_by_agent_id]
        );
        if (agent) {
          actor = { id: agent.id, is_master: !!agent.is_master };
        }
      }

      // Throws WorkflowError (422) on invalid transition
      enforceTransition({
        from: existing.status as TaskStatus,
        to: body.status,
        actor,
      });
    }

    // ── Build field updates ─────────────────────────────────────────────────
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

    // ── Status change ───────────────────────────────────────────────────────
    if (body.status !== undefined && body.status !== existing.status) {
      updates.push('status = ?');
      values.push(body.status);

      const eventType = body.status === 'done' ? 'task_completed' : 'task_status_changed';
      run(
        `INSERT INTO events (id, type, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), eventType, taskId, `Task "${existing.title}" moved to ${body.status}`, now]
      );

      if (body.status === 'in_progress' && existing.assigned_agent_id) {
        shouldDispatch = true;
      }
    }

    // ── Assignment change ───────────────────────────────────────────────────
    if (body.assigned_agent_id !== undefined && body.assigned_agent_id !== existing.assigned_agent_id) {
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
              taskId,
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
      return NextResponse.json(
        { error: 'No updates provided', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    updates.push('updated_at = ?');
    values.push(now);
    values.push(taskId);

    run(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`, values);

    // ── Broadcast via SSE ───────────────────────────────────────────────────
    const updatedTask = getTaskById(taskId);
    if (updatedTask) {
      broadcast({ type: 'task_updated', payload: updatedTask });
    }

    // ── Notion sync ────────────────────────────────────────────────────────
    if (existing.notion_page_id) {
      const { updateNotionTask } = await import('@/lib/notion/client');
      const notionUpdates: Record<string, unknown> = {};
      if (body.title !== undefined) notionUpdates.title = body.title;
      if (body.status !== undefined) notionUpdates.status = body.status;
      if (body.priority !== undefined) notionUpdates.priority = body.priority;
      if (body.description !== undefined) notionUpdates.description = body.description;
      if (body.due_date !== undefined) notionUpdates.due_date = body.due_date;
      if (body.assigned_agent_id && typeof body.assigned_agent_id === 'string') {
        const agn = queryOne<Agent>(
          'SELECT name FROM agents WHERE id = ?',
          [body.assigned_agent_id]
        );
        if (agn) notionUpdates.ai_assignee = agn.name;
      }

      updateNotionTask(existing.notion_page_id, notionUpdates as Parameters<typeof updateNotionTask>[1])
        .then(() => {
          run('UPDATE tasks SET notion_last_synced = ? WHERE id = ?', [new Date().toISOString(), taskId]);
          logger.info({ event: 'notion_task_synced', taskId, title: existing.title });
        })
        .catch((err) => {
          logger.error({ event: 'notion_sync_failed', taskId, title: existing.title }, err);
        });
    }

    // ── Auto-dispatch ───────────────────────────────────────────────────────
    if (shouldDispatch) {
      const missionControlUrl = getMissionControlUrl();
      fetch(`${missionControlUrl}/api/tasks/${taskId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch((err) => {
        logger.error({ event: 'task_auto_dispatch_failed', taskId }, err);
      });
    }

    return NextResponse.json(updatedTask ?? { id: taskId });
  } catch (error) {
    if (error instanceof WorkflowError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.statusCode }
      );
    }
    logger.error({ event: 'task_update_failed', taskId }, error);
    return NextResponse.json({ error: api.internalError('update task') }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = getTaskById(id);

    if (!existing) {
      return NextResponse.json(
        { error: `Task ${id} not found`, code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Cascade deletes via FK constraints (task_activities, task_deliverables)
    run('DELETE FROM openclaw_sessions WHERE task_id = ?', [id]);
    run('DELETE FROM events WHERE task_id = ?', [id]);
    run('UPDATE conversations SET task_id = NULL WHERE task_id = ?', [id]);
    run('DELETE FROM tasks WHERE id = ?', [id]);

    broadcast({ type: 'task_deleted', payload: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ event: 'task_delete_failed' }, error);
    return NextResponse.json({ error: api.internalError('delete task') }, { status: 500 });
  }
}
