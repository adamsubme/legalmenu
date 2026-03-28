/**
 * Shared dispatch logic - send task to OpenClaw agent.
 * Used by POST /api/tasks (auto-dispatch) and POST /api/tasks/[id]/dispatch.
 */
import { v4 as uuidv4 } from 'uuid';
import { queryOne, run } from '@/lib/db';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { generateId, timestamp, updateTaskStatus, updateAgentStatus, insertActivity } from '@/lib/db-helpers';
import { AGENT_MAP } from '@/lib/utils';
import type { Task, Agent } from '@/lib/types';

/**
 * Agent name to OpenClaw ID mapping
 * Derived from AGENT_MAP in utils.ts for single source of truth
 */
const MC_TO_OPENCLAW: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_MAP).map(([id, info]) => [info.name, id])
);

/**
 * Workflow stages - which agents can be delegated to at each stage
 */
const WORKFLOW_STAGES: Record<string, string[]> = {
  intake: ['lex-intake', 'lex-research', 'lex-draft', 'lex-control', 'lex-memory'],
  research: ['lex-research', 'lex-draft', 'lex-control'],
  draft: ['lex-draft', 'lex-control'],
  review: ['lex-control'],
};

export interface DispatchResult {
  success: boolean;
  sessionKey?: string;
  error?: string;
}

export async function dispatchTask(taskId: string): Promise<DispatchResult> {
  const task = queryOne<Task & { assigned_agent_name?: string }>(
    `SELECT t.*, a.name as assigned_agent_name
     FROM tasks t
     LEFT JOIN agents a ON t.assigned_agent_id = a.id
     WHERE t.id = ?`,
    [taskId]
  );

  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  if (!task.assigned_agent_id) {
    return { success: false, error: 'Assign an agent first' };
  }

  const agent = queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [task.assigned_agent_id]);
  if (!agent) {
    return { success: false, error: 'Assigned agent not found' };
  }

  const openclawAgentId = MC_TO_OPENCLAW[agent.name];
  if (!openclawAgentId) {
    return { success: false, error: `Agent ${agent.name} has no OpenClaw mapping. Known agents: ${Object.keys(MC_TO_OPENCLAW).join(', ')}` };
  }

  const client = getOpenClawClient();
  if (!client.isConnected()) {
    try {
      await client.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      console.error('[Dispatch] Failed to connect to OpenClaw Gateway:', msg);
      return { success: false, error: `Failed to connect to OpenClaw: ${msg}` };
    }
  }

  const now = new Date().toISOString();
  const priorityEmoji = { low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴' }[task.priority] || '⚪';

  const workflowInstructions = openclawAgentId === 'lex-coo'
    ? `\n\n**Workflow:**
1. Deleguj do @lex-intake jeśli trzeba uporządkować fakty
2. Deleguj do @lex-research dla analizy prawnej
3. Deleguj do @lex-draft dla tworzenia dokumentów
4. Deleguj do @lex-control dla weryfikacji formalnej
5. Po zakończeniu — zapisz w @lex-memory i poinformuj zleceniodawcę`
    : '';

  const taskMessage = `[Mission Control] ${priorityEmoji} **NOWE ZADANIE**

**Tytuł:** ${task.title}
${task.description ? `**Opis:** ${task.description}\n` : ''}
**Priorytet:** ${task.priority}
${task.due_date ? `**Termin:** ${task.due_date}\n` : ''}
**ID zadania:** ${task.id}

Wykonaj zadanie zgodnie ze swoją specjalizacją.${workflowInstructions}`;

  const sessionKey = `agent:${openclawAgentId}:main`;

  try {
    await client.call('chat.send', {
      sessionKey,
      message: taskMessage,
      idempotencyKey: `dispatch-${task.id}-${Date.now()}`,
    });

    run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', ['in_progress', now, taskId]);
    const updatedTask = queryOne<Task>('SELECT * FROM tasks WHERE id = ?', [taskId]);
    if (updatedTask) {
      broadcast({ type: 'task_updated', payload: updatedTask });
    }

    run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?', ['working', now, agent.id]);
    run(
      `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), 'task_dispatched', agent.id, task.id, `Zadanie "${task.title}" wysłane do ${agent.name}`, now]
    );

    // Log activity
    run(
      `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), task.id, agent.id, 'spawned', `Zadanie przekazane do ${agent.name} via OpenClaw`, now]
    );

    return { success: true, sessionKey };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Dispatch] Failed to send to agent:', msg);
    return { success: false, error: msg };
  }
}
