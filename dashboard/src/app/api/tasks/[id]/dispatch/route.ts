import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { dispatchTask } from '@/lib/dispatch';
import type { Task } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/tasks/[id]/dispatch
 * Sends task to assigned agent's OpenClaw session (agent:bull:main etc.)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const task = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    if (!task) {
      return NextResponse.json({ error: api.tasks.notFound }, { status: 404 });
    }

    const result = await dispatchTask(id);

    if (!result.success) {
      const status = result.error?.includes('connect') ? 503 : 400;
      return NextResponse.json(
        { error: result.error || 'Dispatch failed' },
        { status }
      );
    }

    const updatedTask = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [id]);
    return NextResponse.json({
      success: true,
      task_id: id,
      session_key: result.sessionKey,
      message: 'Task dispatched to agent',
      task: updatedTask,
    });
  } catch (error) {
    logger.error({ event: 'task_dispatch_failed' }, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to dispatch task' },
      { status: 500 }
    );
  }
}
