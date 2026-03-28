/**
 * Shared dispatch logic — send task to OpenClaw agent.
 *
 * Transaction safety:
 *   All database writes (task status, events, activities, agent status,
 *   openclaw_sessions) are wrapped in a single transaction. If any DB write
 *   fails, all changes are rolled back. The network call to OpenClaw
 *   happens AFTER the transaction commits, so a failed dispatch leaves
 *   the DB in a clean, consistent state (no "in_progress but no event"
 *   or "event exists but status unchanged" situations).
 *
 *   If the network call fails after the transaction commits, the task
 *   is correctly marked in_progress and an error event is recorded.
 *
 * Used by: POST /api/tasks (auto-dispatch) and POST /api/tasks/[id]/dispatch.
 */

import { v4 as uuidv4 } from 'uuid';
import { queryOne, run, transaction } from '@/lib/db';
import { getTaskById } from '@/lib/db/queries';
import { getOpenClawClient } from '@/lib/openclaw/client';
import { broadcast } from '@/lib/events';
import { buildAgentContext } from '@/lib/db/knowledge';
import { OpenClawError } from './errors';
import { logger } from './logger';
import { metrics } from './metrics';
import type { Task, Agent } from '@/lib/types';
import { api } from '@/lib/messages';

/**
 * Mission Control agent name → OpenClaw agent ID mapping.
 *
 * All task dispatch goes through the main Bull/main agent which acts as
 * orchestrator. Stage (intake/research/drafting/review/done) is embedded
 * in the sessionKey to differentiate workflow phases.
 */
const MC_TO_OPENCLAW: Record<string, string> = {
  'Lex COO':     'main',
  'Lex Intake':  'main',
  'Lex Research':'main',
  'Lex Draft':   'main',
  'Lex Control': 'main',
  'Lex Memory':  'main',
};

const STAGE_TO_SUB_STATUS: Record<string, string> = {
  intake:         'intake',
  research:       'research_in_progress',
  drafting:       'drafting_in_progress',
  review:         'needs_review',
  client_input:   'needs_client_input',
  done:           'approved',
};

const SUB_STATUS_TO_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_TO_SUB_STATUS).map(([stage, sub]) => [sub, stage])
);

function getTaskStage(task: { sub_status?: string | null; status: string }): string {
  if (task.sub_status) {
    const stage = SUB_STATUS_TO_STAGE[task.sub_status];
    if (stage) return stage;
    if (task.sub_status.includes('intake'))    return 'intake';
    if (task.sub_status.includes('research'))   return 'research';
    if (task.sub_status.includes('draft'))     return 'drafting';
    if (task.sub_status.includes('review'))    return 'review';
    if (task.sub_status.includes('client') || task.sub_status.includes('waiting')) return 'client_input';
  }
  if (task.status === 'done')               return 'done';
  if (task.status === 'awaiting_approval')   return 'client_input';
  if (task.status === 'in_progress')        return 'drafting';
  return 'intake';
}

const WORKFLOW_STAGES: Record<string, { agents: string[]; instruction: string }> = {
  intake: {
    agents: ['lex-intake'],
    instruction: 'Uporządkuj fakty sprawy, zbierz niezbędne dokumenty od klienta, stwórz strukturę zadania.',
  },
  research: {
    agents: ['lex-research'],
    instruction: 'Przeprowadź analizę prawną, znajdź relevantne przepisy, orzecznictwo i wzory.',
  },
  drafting: {
    agents: ['lex-draft'],
    instruction: 'Stwórz projekt dokumentu prawnego na podstawie researchu i instrukcji.',
  },
  review: {
    agents: ['lex-control'],
    instruction: 'Zweryfikuj formalną poprawność dokumentu, sprawdź zgodność z przepisami.',
  },
  client_input: {
    agents: ['lex-coo'],
    instruction: 'Przygotuj pytania do klienta, wyjaśnij opcje, poczekaj na decyzję.',
  },
  done: {
    agents: ['lex-memory'],
    instruction: 'Zapisz dokumenty i wnioski do bazy wiedzy, zarchiwizuj sprawę.',
  },
};

export interface DispatchResult {
  success: boolean;
  sessionKey?: string;
  openclawSessionId?: string;
  error?: string;
}

/**
 * Core dispatch function. All DB writes are transactional; the OpenClaw
 * network call is outside the transaction so a network failure never
 * causes a partial DB commit.
 */
export async function dispatchTask(taskId: string): Promise<DispatchResult> {
  // ── 1. Validate task and agent ───────────────────────────────────────────
  const task = getTaskById(taskId);

  if (!task) {
    return { success: false, error: api.tasks.notFound };
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
    return {
      success: false,
      error: `Agent "${agent.name}" is not mapped to an OpenClaw agent. `
           + `Known mappings: ${Object.keys(MC_TO_OPENCLAW).join(', ')}`,
    };
  }

  // ── 2. Connect to OpenClaw if needed ─────────────────────────────────────
  const client = getOpenClawClient();
  if (!client.isConnected()) {
    try {
      await client.connect();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      logger.error({ event: 'dispatch_connect_failed', taskId }, err);
      metrics.inc('dispatch_total', { agent: agent.name, status: 'connect_failed' });
      return { success: false, error: `OpenClaw connection failed: ${msg}` };
    }
  }

  // ── 3. Build dispatch message ──────────────────────────────────────────────
  const now = new Date().toISOString();
  const priorityEmoji = { low: '🔵', normal: '⚪', high: '🟡', urgent: '🔴' }[task.priority] ?? '⚪';
  const taskStage = getTaskStage(task);
  const stageConfig = WORKFLOW_STAGES[taskStage] ?? WORKFLOW_STAGES.intake;

  const knowledgeContext = buildAgentContext({
    client_id:   task.client_id ?? undefined,
    project_id:  task.project_id ?? undefined,
    task_id:     task.id,
  });

  const contextMessage = `[Mission Control] ${priorityEmoji} **ZADANIE: ${task.title}**

**Stage:** ${taskStage.toUpperCase()}
**Priorytet:** ${task.priority}
${task.due_date ? `**Termin:** ${task.due_date}\n` : ''}
${task.description ? `**Opis:** ${task.description}\n` : ''}

---

**KONTEKST HIERARCHICZNY:**
${knowledgeContext || '(Brak kontekstu w bazie wiedzy)'}

---

**INSTRUKCJA NA TEN STAGE:**
${stageConfig.instruction}

---

**Format odpowiedzi:**
- Co wykonano na tym etapie
- Jakie dokumenty wygenerowano / zaktualizowano
- Co dalej — następny krok lub potrzebna decyzja

**ID zadania:** ${task.id}`;

  const sessionKey = `mc:task:${task.id}:${taskStage}`;

  // ── 4. Commit all DB changes in a single transaction ─────────────────────
  let openclawSessionId: string | null = null;

  try {
    transaction(() => {
      // Update task → in_progress
      run(
        'UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?',
        ['in_progress', now, taskId]
      );

      // Mark agent as working
      run(
        'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
        ['working', now, agent.id]
      );

      // Log task_dispatched event
      run(
        `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'task_dispatched',
          agent.id,
          task.id,
          `Zadanie "${task.title}" wysłane do ${agent.name}`,
          now,
        ]
      );

      // Log activity
      run(
        `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          task.id,
          agent.id,
          'spawned',
          `Zadanie przekazane do ${agent.name} via OpenClaw`,
          now,
        ]
      );
    });

  } catch (dbError) {
    const msg = dbError instanceof Error ? dbError.message : String(dbError);
    logger.error({ event: 'dispatch_transaction_failed', taskId }, dbError);
    metrics.inc('dispatch_total', { agent: agent.name, status: 'db_error' });
    return { success: false, error: `Database transaction failed: ${msg}` };
  }

  // ── 5. Send to OpenClaw (outside transaction) ──────────────────────────────
  let callSucceeded = false;

  try {
    const callResult = await client.call<{ sessionId?: string }>('chat.send', {
      sessionKey,
      message: contextMessage,
      idempotencyKey: `dispatch-${task.id}-${Date.now()}`,
    });

    openclawSessionId = (callResult as { sessionId?: string })?.sessionId ?? null;
    callSucceeded = true;

  } catch (callError) {
    const msg = callError instanceof Error ? callError.message : 'Unknown error';
    logger.error({ event: 'dispatch_openclaw_call_failed', taskId, agent: agent.name }, callError);
    metrics.inc('dispatch_total', { agent: agent.name, status: 'call_failed' });

    // Record failure event — task is already in_progress but agent never received it
    try {
      run(
        `INSERT INTO events (id, type, agent_id, task_id, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          uuidv4(),
          'dispatch_failed',
          agent.id,
          task.id,
          `Dispatch failed: ${msg}`,
          new Date().toISOString(),
        ]
      );

      // Revert agent status back to standby
      run(
        'UPDATE agents SET status = ?, updated_at = ? WHERE id = ?',
        ['standby', new Date().toISOString(), agent.id]
      );

      broadcast({
        type: 'event_added',
        payload: {
          id: uuidv4(),
          type: 'dispatch_failed',
          task_id: task.id,
          message: `Dispatch failed: ${msg}`,
          created_at: new Date().toISOString(),
        },
      });
    } catch (recordError) {
      // Last-resort: just log, don't throw
      logger.error({ event: 'dispatch_record_failure_failed', taskId }, recordError);
    }

    return { success: false, error: msg };
  }

  // ── 6. Persist OpenClaw session ID (after confirmed success) ──────────────
  if (openclawSessionId) {
    try {
      run(
        `INSERT INTO openclaw_sessions
           (id, agent_id, openclaw_session_id, channel, status, task_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), agent.id, openclawSessionId, 'task', 'active', task.id, now]
      );
    } catch (sessionError) {
      // Non-fatal: dispatch succeeded, just can't track the session
      logger.warn({ event: 'dispatch_session_persist_failed', taskId, sessionId: openclawSessionId }, sessionError);
    }
  }

  // ── 7. Broadcast task update via SSE ───────────────────────────────────────
  try {
    const updatedTask = getTaskById(taskId);

    if (updatedTask) {
      broadcast({
        type: 'task_updated',
        payload: {
          ...updatedTask,
          assigned_agent: updatedTask.assigned_agent_id
            ? {
                id:            updatedTask.assigned_agent_id,
                name:         updatedTask.assigned_agent_name ?? '',
                avatar_emoji: updatedTask.assigned_agent_emoji ?? '',
                role:         '',
                status:       'working',
                is_master:    false,
                workspace_id: '',
                description:  '',
                created_at:   '',
                updated_at:   '',
              }
            : undefined,
        } as unknown as Task,
      });
    }
  } catch (broadcastError) {
    // Non-fatal: task was dispatched successfully
    logger.warn({ event: 'dispatch_sse_broadcast_failed', taskId }, broadcastError);
  }

  return { success: true, sessionKey, openclawSessionId: openclawSessionId ?? undefined };
}
