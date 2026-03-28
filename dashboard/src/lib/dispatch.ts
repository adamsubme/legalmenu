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

// Stage to sub_status mapping (matches cases/page.tsx)
const STAGE_TO_SUB_STATUS: Record<string, string> = {
  intake: 'intake',
  research: 'research_in_progress',
  drafting: 'drafting_in_progress',
  review: 'needs_review',
  client_input: 'needs_client_input',
  done: 'approved',
};

// Sub_status to stage mapping
const SUB_STATUS_TO_STAGE: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_TO_SUB_STATUS).map(([stage, sub]) => [sub, stage])
);

// Get workflow stage from task
function getTaskStage(task: Task): string {
  // Check sub_status first
  if (task.sub_status) {
    const stage = SUB_STATUS_TO_STAGE[task.sub_status];
    if (stage) return stage;
    // Fallback patterns
    if (task.sub_status.includes('intake')) return 'intake';
    if (task.sub_status.includes('research')) return 'research';
    if (task.sub_status.includes('draft')) return 'drafting';
    if (task.sub_status.includes('review')) return 'review';
    if (task.sub_status.includes('client') || task.sub_status.includes('waiting')) return 'client_input';
  }
  // Fallback to status
  if (task.status === 'done') return 'done';
  if (task.status === 'awaiting_approval') return 'client_input';
  if (task.status === 'in_progress') return 'drafting';
  return 'intake';
}

/**
 * Workflow stages - maps to Kanban columns and determines which agent handles each stage
 * Main coordinator (lex-coo) delegates to specialist agents based on stage
 */
const WORKFLOW_STAGES: Record<string, { agents: string[]; instruction: string }> = {
  intake: {
    agents: ['lex-intake'],
    instruction: 'Uporządkuj fakty sprawy, zbierz niezbędne dokumenty od klienta, stwórz strukturę zadania.'
  },
  research: {
    agents: ['lex-research'],
    instruction: 'Przeprowadź analizę prawną, znajdź relevantne przepisy, orzecznictwo i wzory.'
  },
  drafting: {
    agents: ['lex-draft'],
    instruction: 'Stwórz projekt dokumentu prawnego na podstawie researchu i instrukcji.'
  },
  review: {
    agents: ['lex-control'],
    instruction: 'Zweryfikuj formalną poprawność dokumentu, sprawdź zgodność z przepisami.'
  },
  client_input: {
    agents: ['lex-coo'],
    instruction: 'Przygotuj pytania do klienta, wyjaśnij opcje, poczekaj na decyzję.'
  },
  done: {
    agents: ['lex-memory'],
    instruction: 'Zapisz dokumenty i wnioski do bazy wiedzy, zarchiwizuj sprawę.'
  },
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
  
  // Determine workflow stage and get instructions for this stage
  const taskStage = getTaskStage(task);
  const stageConfig = WORKFLOW_STAGES[taskStage] || WORKFLOW_STAGES.intake;
  const specialistInstruction = stageConfig.instruction;

  // Build hierarchical context message
  const contextMessage = `[Mission Control] ${priorityEmoji} **ZADANIE: ${task.title}**

**Stage:** ${taskStage.toUpperCase()}
**Priorytet:** ${task.priority}
${task.due_date ? `**Termin:** ${task.due_date}\n` : ''}
${task.description ? `**Opis:** ${task.description}\n` : ''}

---

**KONTEKST HIERARCHICZNY:**

1. **Globalna baza prawna** — przepisy, wzory, orzecznictwo
2. **Baza klienta** — dane klienta, historia współpracy
3. **Baza projektu** — AML/KYC/MiCA/CASP, specyfika projektu
4. **Baza sprawy** — dotychczasowe dokumenty, research, uwagi

---

**INSTRUKCJA NA TEN STAGE:**
${specialistInstruction}

---

**Format odpowiedzi:**
- Co wykonano na tym etapie
- Jakie dokumenty wygenerowano / zaktualizowano
- Co dalej — następny krok lub potrzebna decyzja

**ID zadania:** ${task.id}`;

  const sessionKey = `task:${task.id}:${openclawAgentId}:${taskStage}`;

  try {
    await client.call('chat.send', {
      sessionKey,
      message: contextMessage,
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
