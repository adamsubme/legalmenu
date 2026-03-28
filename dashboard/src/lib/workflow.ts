/**
 * Task workflow state machine.
 *
 * Defines valid status transitions and enforces business rules
 * (e.g., approval gate before marking a task done).
 *
 * All transition checks go through canTransition() so the rules
 * are in one place and testable in isolation.
 */

import { taskStatusSchema } from './validation';
import { WorkflowError } from './errors';

// ── Statuses ───────────────────────────────────────────────────────────────────

export const TASK_STATUSES = [
  'not_started',
  'in_progress',
  'intake',
  'research',
  'drafting',
  'review',
  'testing',
  'client_input',
  'awaiting_approval',
  'done',
  'cancelled',
  'blocked',
  'planning',
] as const;

export type TaskStatus = typeof TASK_STATUSES[number];

// ── Transition rules ────────────────────────────────────────────────────────────

/**
 * Valid status transitions.
 * Key = from status, Value = array of statuses that can follow.
 */
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  not_started:    ['intake', 'cancelled'],
  in_progress:    ['done', 'cancelled', 'blocked'],
  intake:         ['research', 'cancelled'],
  research:       ['drafting', 'cancelled'],
  drafting:       ['review', 'cancelled'],
  review:         ['testing', 'client_input', 'cancelled'],
  testing:        ['review', 'awaiting_approval', 'cancelled'],
  client_input:   ['review', 'cancelled'],
  awaiting_approval: ['done'],   // Only master agent can move from here
  done:           ['research', 'cancelled'],  // Can reopen to research
  cancelled:      ['not_started'],
  blocked:        ['not_started', 'cancelled'],
  planning:       ['intake', 'cancelled'],
};

// ── Approval gate ──────────────────────────────────────────────────────────────

/**
 * Statuses that represent the "in review / waiting for human" gate.
 * Moving from one of these to done requires an explicit approval action.
 */
const APPROVAL_GATE_STATUSES = new Set<TaskStatus>([
  'awaiting_approval',
  'testing',
  'review',
]);

// ── Transition guard ───────────────────────────────────────────────────────────

export interface TransitionContext {
  from: TaskStatus;
  to: TaskStatus;
  actor?: {
    id: string;
    is_master?: boolean;
  };
}

export interface TransitionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Checks whether a status transition is permitted.
 *
 * Rules:
 *  1. Transition must be in TRANSITIONS[from]
 *  2. Moving to 'done' from any APPROVAL_GATE status requires a master agent actor
 *
 * @param ctx.from        Current task status
 * @param ctx.to          Desired new status
 * @param ctx.actor       Who/what is requesting the change (agent or user)
 */
export function canTransition(ctx: TransitionContext): TransitionResult {
  const { from, to, actor } = ctx;

  // ── Rule 1: Check allowlist ──────────────────────────────────────────────
  const allowed = TRANSITIONS[from] ?? [];

  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Cannot move task from "${from}" directly to "${to}". `
            + `Allowed transitions from "${from}": ${allowed.join(', ') || 'none'}.`,
    };
  }

  // ── Rule 2: Approval gate ───────────────────────────────────────────────
  if (to === 'done' && APPROVAL_GATE_STATUSES.has(from)) {
    if (!actor?.is_master) {
      const gateName = from === 'awaiting_approval' ? 'awaiting_approval' : from;
      return {
        allowed: false,
        reason: `Cannot approve task — requires a master agent. `
              + `Task is currently "${from}". Only a master agent can move tasks from "${gateName}" to "done".`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Like canTransition but throws WorkflowError when disallowed.
 * Use this in route handlers for clean control flow:
 *
 *   enforceTransition({ from: existing.status, to: body.status, actor });
 */
export function enforceTransition(ctx: TransitionContext): void {
  const result = canTransition(ctx);
  if (!result.allowed) {
    throw new WorkflowError(result.reason!, {
      from: ctx.from,
      to: ctx.to,
      actor: ctx.actor,
    });
  }
}

/**
 * Returns the next logical status after a successful agent stage.
 * Used by the dispatch/agent system to advance workflow automatically.
 */
export function nextStageAfterAgent(current: TaskStatus): TaskStatus {
  const next: Partial<Record<TaskStatus, TaskStatus>> = {
    intake:   'research',
    research: 'drafting',
    drafting: 'review',
    review:   'client_input',
    client_input: 'done',    // Client approved → done
    testing:  'awaiting_approval',
  };
  return next[current] ?? current;
}

/**
 * Returns all statuses that can be directly transitioned to
 * from the given status. Useful for building UI option lists.
 */
export function allowedTransitions(from: TaskStatus): TaskStatus[] {
  return TRANSITIONS[from] ?? [];
}

/**
 * Returns true if the given status is an approval-gate status
 * (requires master agent to finalize to done).
 */
export function isApprovalGate(status: TaskStatus): boolean {
  return APPROVAL_GATE_STATUSES.has(status);
}

/**
 * Validates that a raw string is a known task status.
 * Use this to validate database values or external input.
 */
export function isValidStatus(s: string): s is TaskStatus {
  return TASK_STATUSES.includes(s as TaskStatus);
}
