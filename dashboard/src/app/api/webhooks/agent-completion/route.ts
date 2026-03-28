import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { queryOne, queryAll, run } from '@/lib/db';
import { getTaskById, listTasks } from '@/lib/db/queries';
import type { OpenClawSession } from '@/lib/types';
import { api } from '@/lib/messages';
import { logger } from '@/lib/logger';

/**
 * POST /api/webhooks/agent-completion
 * 
 * Receives completion notifications from agents.
 * Expected payload:
 * {
 *   "session_id": "mission-control-engineering",
 *   "message": "TASK_COMPLETE: Built the authentication system"
 * }
 * 
 * Or can be called with task_id directly:
 * {
 *   "task_id": "uuid",
 *   "summary": "Completed the task successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const now = new Date().toISOString();

    // Handle direct task_id completion
    if (body.task_id) {
      const task = getTaskById(body.task_id);

      if (!task) {
        return NextResponse.json({ error: api.tasks.notFound }, { status: 404 });
      }

      // Only move to testing if not already in testing, review, or done
      // (Don't overwrite user's approval or testing results)
      if (task.status !== 'awaiting_approval' && task.status !== 'done') {
        run(
          'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
          ['awaiting_approval', now, task.id]
        );
      }

      // Log completion
      run(
        `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'task_completed',
          task.assigned_agent_id,
          task.id,
          `${task.assigned_agent_name} completed: ${body.summary || 'Task finished'}`,
          now
        ]
      );

      // Set agent back to standby
      if (task.assigned_agent_id) {
        run(
          'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
          ['standby', now, task.assigned_agent_id]
        );
      }

      return NextResponse.json({
        success: true,
        task_id: task.id,
        new_status: 'awaiting_approval',
        message: 'Task moved to testing for automated verification'
      });
    }

    // Handle session-based completion (from message parsing)
    if (body.session_id && body.message) {
      // Parse TASK_COMPLETE message
      const completionMatch = body.message.match(/TASK_COMPLETE:\s*(.+)/i);
      if (!completionMatch) {
        return NextResponse.json(
          { error: api.agentCompletion.invalidFormat },
          { status: 400 }
        );
      }

      const summary = completionMatch[1].trim();

      // Find agent by session
      const session = queryOne<OpenClawSession>(
        'SELECT * FROM openclaw_sessions WHERE openclaw_session_id = ? AND status = ?',
        [body.session_id, 'active']
      );

      if (!session) {
        return NextResponse.json(
          { error: api.agentCompletion.sessionNotFound },
          { status: 404 }
        );
      }

      // Find active task for this agent
      const tasks = listTasks({
        assignedAgentId: session.agent_id,
        status: ['not_started', 'in_progress'],
        limit: 1,
      });
      const task = tasks[0];

      if (!task) {
        return NextResponse.json(
          { error: api.agentCompletion.noActiveTask },
          { status: 404 }
        );
      }

      // Only move to testing if not already in testing, review, or done
      // (Don't overwrite user's approval or testing results)
      if (task.status !== 'awaiting_approval' && task.status !== 'done') {
        run(
          'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
          ['awaiting_approval', now, task.id]
        );
      }

      // Log completion with summary
      run(
        `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'task_completed',
          session.agent_id,
          task.id,
          `${task.assigned_agent_name} completed: ${summary}`,
          now
        ]
      );

      // Set agent back to standby
      run(
        'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
        ['standby', now, session.agent_id]
      );

      return NextResponse.json({
        success: true,
        task_id: task.id,
        agent_id: session.agent_id,
        summary,
        new_status: 'awaiting_approval',
        message: 'Task moved to testing for automated verification'
      });
    }

    return NextResponse.json(
      { error: api.agentCompletion.invalidPayload },
      { status: 400 }
    );
  } catch (error) {
    logger.error({ event: 'agent_completion_webhook_failed' }, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process completion' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/agent-completion
 * 
 * Returns webhook status and recent completions
 */
export async function GET() {
  try {
    const recentCompletions = queryAll(
      `SELECT e.*, a.name as agent_name, t.title as task_title
       FROM events e
       LEFT JOIN agents a ON e.agent_id = a.id
       LEFT JOIN tasks t ON e.task_id = t.id
       WHERE e.type = 'task_completed'
       ORDER BY e.created_at DESC
       LIMIT 10`
    );

    return NextResponse.json({
      status: 'active',
      recent_completions: recentCompletions,
      endpoint: '/api/webhooks/agent-completion'
    });
  } catch (error) {
    logger.error({ event: 'completion_status_fetch_failed' }, error);
    return NextResponse.json(
      { error: 'Failed to fetch status' },
      { status: 500 }
    );
  }
}
