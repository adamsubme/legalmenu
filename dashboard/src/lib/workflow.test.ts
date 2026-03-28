/**
 * Workflow state machine — tests.
 *
 * These tests verify the business rules encoded in canTransition():
 *  1. TRANSITIONS map defines which status → status moves are valid
 *  2. Approval gate: moving to 'done' from an APPROVAL_GATE status
 *     requires a master agent
 *  3. All helper functions produce correct results
 *
 * Tests are named: "given [from] + [to] + [actor] → [expected result]"
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  enforceTransition,
  allowedTransitions,
  isApprovalGate,
  isValidStatus,
  nextStageAfterAgent,
  TASK_STATUSES,
  type TransitionContext,
} from './workflow';
import { WorkflowError } from './errors';

// ── Happy path: valid transitions ────────────────────────────────────────────────

describe('canTransition — valid transitions', () => {
  const validCases: Array<[from: string, to: string]> = [
    ['not_started',   'intake'],
    ['not_started',  'cancelled'],
    ['in_progress',  'done'],
    ['in_progress',  'cancelled'],
    ['in_progress',  'blocked'],
    ['intake',       'research'],
    ['intake',       'cancelled'],
    ['research',     'drafting'],
    ['research',     'cancelled'],
    ['drafting',     'review'],
    ['drafting',     'cancelled'],
    ['review',       'testing'],
    ['review',       'client_input'],
    ['review',       'cancelled'],
    ['testing',      'review'],
    ['testing',      'awaiting_approval'],
    ['testing',      'cancelled'],
    ['client_input', 'review'],
    ['client_input', 'cancelled'],
    ['done',         'research'],
    ['done',         'cancelled'],
    ['cancelled',    'not_started'],
    ['blocked',      'not_started'],
    ['blocked',      'cancelled'],
    ['planning',     'intake'],
    ['planning',     'cancelled'],
  ];

  validCases.forEach(([from, to]) => {
    it(`given ${from} → ${to} (no actor) → allowed`, () => {
      const result = canTransition({ from: from as any, to: to as any });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });
  });
});

// ── Rejection: invalid transitions ─────────────────────────────────────────────

describe('canTransition — invalid transitions', () => {
  const invalidCases: Array<[from: string, to: string, expectedToInclude?: string]> = [
    ['not_started',    'done',          'not_started'],
    ['not_started',    'research',      'not_started'],
    ['not_started',    'drafting',      'not_started'],
    ['in_progress',    'intake',        'in_progress'],
    ['in_progress',    'research',      'in_progress'],
    ['in_progress',    'awaiting_approval', 'in_progress'],
    ['intake',         'drafting',      'intake'],
    ['research',       'review',        'research'],
    ['drafting',       'testing',       'drafting'],
    ['review',         'done',          'review'],
    ['testing',        'done',          'testing'],
    ['client_input',   'done',          'client_input'],
    ['awaiting_approval', 'review',     'awaiting_approval'],
    ['awaiting_approval', 'cancelled',  'awaiting_approval'],
    ['done',           'not_started',  'done'],
    ['cancelled',      'intake',        'cancelled'],
    ['cancelled',      'done',          'cancelled'],
    ['blocked',        'intake',        'blocked'],
    ['blocked',        'research',      'blocked'],
    ['planning',       'done',          'planning'],
    ['planning',       'review',        'planning'],
  ];

  invalidCases.forEach(([from, to, _expected]) => {
    it(`given ${from} → ${to} → denied with reason`, () => {
      const result = canTransition({ from: from as any, to: to as any });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason!.length).toBeGreaterThan(0);
    });
  });
});

// ── Approval gate: master agent required ───────────────────────────────────────

describe('canTransition — approval gate (to done from gate status)', () => {
  // Only awaiting_approval can go to done (defined in TRANSITIONS).
  // testing and review CANNOT go to done at all (not in TRANSITIONS).

  it('awaiting_approval → done (no actor) → denied (requires master)', () => {
    const result = canTransition({ from: 'awaiting_approval', to: 'done' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('master agent');
  });

  it('awaiting_approval → done (non-master) → denied (requires master)', () => {
    const result = canTransition({
      from: 'awaiting_approval',
      to: 'done',
      actor: { id: 'agent-1', is_master: false },
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('master agent');
  });

  it('awaiting_approval → done (master actor) → allowed', () => {
    const result = canTransition({
      from: 'awaiting_approval',
      to: 'done',
      actor: { id: 'coo-1', is_master: true },
    });
    expect(result.allowed).toBe(true);
  });

  it('awaiting_approval → done (actor without is_master) → denied', () => {
    const result = canTransition({
      from: 'awaiting_approval',
      to: 'done',
      actor: { id: 'agent-1' },
    });
    expect(result.allowed).toBe(false);
  });

  // These are in APPROVAL_GATE_STATUSES but CANNOT go to done at all
  // (the transition doesn't exist in TRANSITIONS). This is a SEPARATE concern
  // from the master-agent gate.
  it('review → done → denied (not in TRANSITIONS, not just approval gate)', () => {
    const result = canTransition({ from: 'review', to: 'done' });
    expect(result.allowed).toBe(false);
    // The reason should mention allowed transitions (not just "master agent")
    expect(result.reason).toContain('Allowed transitions');
  });

  it('testing → done → denied (not in TRANSITIONS)', () => {
    const result = canTransition({ from: 'testing', to: 'done' });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Allowed transitions');
  });
});

// ── Which statuses can transition to done (without master)? ─────────────────
// According to TRANSITIONS map:
//   in_progress → done ✓
//   awaiting_approval → done ✓ (but gated by master requirement)
//   done → done (reopen) ✓
// All other statuses CANNOT go to done at all (transition not in allowlist).

describe('canTransition — which statuses can go to done', () => {
  it('in_progress → done → allowed (no master needed, not in approval gate)', () => {
    const result = canTransition({ from: 'in_progress', to: 'done' });
    expect(result.allowed).toBe(true);
  });

  it('awaiting_approval → done → allowed with master, denied without', () => {
    expect(canTransition({ from: 'awaiting_approval', to: 'done' }).allowed).toBe(false);
    expect(canTransition({ from: 'awaiting_approval', to: 'done', actor: { id: 'x', is_master: true } }).allowed).toBe(true);
  });

  // done → done is NOT in TRANSITIONS (done can only go to research or cancelled)
  it('done → done → denied (not in TRANSITIONS — reopen is to research/cancelled)', () => {
    const result = canTransition({ from: 'done', to: 'done' });
    expect(result.allowed).toBe(false);
  });

  // These fail because the transition doesn't exist in TRANSITIONS, not due to approval gate:
  it('not_started → done → denied (not in TRANSITIONS)', () => {
    expect(canTransition({ from: 'not_started', to: 'done' }).allowed).toBe(false);
  });

  it('review → done → denied (not in TRANSITIONS)', () => {
    expect(canTransition({ from: 'review', to: 'done' }).allowed).toBe(false);
  });

  it('testing → done → denied (not in TRANSITIONS)', () => {
    expect(canTransition({ from: 'testing', to: 'done' }).allowed).toBe(false);
  });

  it('cancelled → done → denied (not in TRANSITIONS)', () => {
    expect(canTransition({ from: 'cancelled', to: 'done' }).allowed).toBe(false);
  });
});

// ── enforceTransition ───────────────────────────────────────────────────────────

describe('enforceTransition — throws WorkflowError on invalid', () => {
  it('given valid transition → does not throw', () => {
    expect(() => enforceTransition({ from: 'intake', to: 'research' })).not.toThrow();
  });

  it('given invalid transition → throws WorkflowError with reason', () => {
    expect(() => enforceTransition({ from: 'not_started', to: 'done' }))
      .toThrow(WorkflowError);
  });

  it('given invalid transition → WorkflowError has correct code and details', () => {
    try {
      enforceTransition({ from: 'review' as any, to: 'done' as any });
    } catch (e) {
      expect(e).toBeInstanceOf(WorkflowError);
      expect((e as WorkflowError).code).toBe('WORKFLOW_ERROR');
      expect((e as WorkflowError).statusCode).toBe(422);
      expect((e as WorkflowError).details).toMatchObject({
        from: 'review',
        to: 'done',
      });
    }
  });
});

// ── allowedTransitions ─────────────────────────────────────────────────────────

describe('allowedTransitions', () => {
  it('given not_started → returns [intake, cancelled]', () => {
    expect(allowedTransitions('not_started')).toEqual(['intake', 'cancelled']);
  });

  it('given awaiting_approval → returns [done]', () => {
    expect(allowedTransitions('awaiting_approval')).toEqual(['done']);
  });

  it('given done → returns [research, cancelled]', () => {
    expect(allowedTransitions('done')).toEqual(['research', 'cancelled']);
  });

  it('given cancelled → returns [not_started]', () => {
    expect(allowedTransitions('cancelled')).toEqual(['not_started']);
  });

  it('given unknown status → returns []', () => {
    expect(allowedTransitions('unknown' as any)).toEqual([]);
  });
});

// ── isApprovalGate ─────────────────────────────────────────────────────────────

describe('isApprovalGate', () => {
  it('returns true for awaiting_approval, testing, review', () => {
    expect(isApprovalGate('awaiting_approval')).toBe(true);
    expect(isApprovalGate('testing')).toBe(true);
    expect(isApprovalGate('review')).toBe(true);
  });

  it('returns false for all other statuses', () => {
    const nonGate = TASK_STATUSES.filter(
      s => !['awaiting_approval', 'testing', 'review'].includes(s)
    );
    nonGate.forEach(status => {
      expect(isApprovalGate(status)).toBe(false);
    });
  });
});

// ── isValidStatus ─────────────────────────────────────────────────────────────

describe('isValidStatus', () => {
  TASK_STATUSES.forEach(status => {
    it(`returns true for valid status: ${status}`, () => {
      expect(isValidStatus(status)).toBe(true);
    });
  });

  it('returns false for invalid string', () => {
    expect(isValidStatus('invalid_status')).toBe(false);
    expect(isValidStatus('')).toBe(false);
    expect(isValidStatus('DONE')).toBe(false);  // Case-sensitive
  });
});

// ── nextStageAfterAgent ────────────────────────────────────────────────────────

describe('nextStageAfterAgent', () => {
  const cases: Array<[from: string, expected: string]> = [
    ['intake',       'research'],
    ['research',     'drafting'],
    ['drafting',     'review'],
    ['review',       'client_input'],
    ['client_input', 'done'],
    ['testing',      'awaiting_approval'],
    // Statuses not in the map stay unchanged
    ['not_started',  'not_started'],
    ['awaiting_approval', 'awaiting_approval'],
    ['done',         'done'],
    ['cancelled',    'cancelled'],
    ['planning',     'planning'],
  ];

  cases.forEach(([from, expected]) => {
    it(`given ${from} → returns ${expected}`, () => {
      expect(nextStageAfterAgent(from as any)).toBe(expected);
    });
  });
});
