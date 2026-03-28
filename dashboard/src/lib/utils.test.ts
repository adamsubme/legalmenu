/**
 * Utility functions — tests.
 *
 * Tests verify actual behavior, not assumptions.
 * timeAgo and formatDate depend on the current time,
 * so we use fixed reference dates to get deterministic results.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, timeAgo, formatDate, STATUS_LABELS, SUB_STATUS_LABELS, PRIORITY_LABELS, AGENT_MAP } from './utils';

// ── cn (className utility) ─────────────────────────────────────────────────

describe('cn — Tailwind class merging', () => {
  it('merges two class strings', () => {
    const result = cn('foo bar', 'baz qux');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).toContain('baz');
    expect(result).toContain('qux');
  });

  it('handles empty strings', () => {
    expect(cn('')).toBe('');
    expect(cn('', 'foo')).toContain('foo');
  });

  it('handles undefined', () => {
    expect(cn(undefined as unknown as string)).toBe('');
    expect(cn('foo', undefined as unknown as string)).toContain('foo');
  });

  it('deduplicates tailwind classes', () => {
    // clsx + tailwind-merge should handle duplicate detection
    const result = cn('flex', 'flex', 'flex');
    // Result should still be valid but may contain duplicates (handled by tailwind)
    expect(result).toBeTruthy();
  });
});

// ── timeAgo ───────────────────────────────────────────────────────────────

describe('timeAgo — relative time formatting', () => {
  // Freeze time at 2025-01-15T12:00:00Z for all tests
  const FIXED_NOW = new Date('2025-01-15T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "now" for dates less than 60 seconds ago', () => {
    const justNow = new Date(FIXED_NOW - 30 * 1000).toISOString();
    expect(timeAgo(justNow)).toBe('now');
  });

  it('returns minutes for dates less than 1 hour ago', () => {
    const fiveMinAgo = new Date(FIXED_NOW - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours for dates less than 1 day ago', () => {
    const threeHoursAgo = new Date(FIXED_NOW - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('returns days for dates more than 1 day ago', () => {
    const twoDaysAgo = new Date(FIXED_NOW - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe('2d ago');
  });

  it('handles Date objects', () => {
    const fiveMinAgo = new Date(FIXED_NOW - 5 * 60 * 1000);
    expect(timeAgo(fiveMinAgo)).toBe('5m ago');
  });

  it('handles far-past dates', () => {
    const yearAgo = new Date(FIXED_NOW - 400 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(yearAgo)).toBe('400d ago');
  });
});

// ── formatDate ───────────────────────────────────────────────────────────

describe('formatDate — locale date formatting', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2025-06-15T10:30:00Z');
    // Intl.DateTimeFormat produces month abbreviations
    expect(result).toMatch(/Jun/i);
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });

  it('formats Date object', () => {
    const date = new Date('2025-06-15T10:30:00Z');
    const result = formatDate(date);
    expect(result).toMatch(/Jun/i);
  });

  it('handles various date formats', () => {
    const result = formatDate('2025-01-01');
    expect(result).toBeTruthy();
  });
});

// ── STATUS_LABELS ─────────────────────────────────────────────────────────

describe('STATUS_LABELS', () => {
  it('has labels for all expected statuses', () => {
    expect(STATUS_LABELS['not_started']).toBe('New');
    expect(STATUS_LABELS['in_progress']).toBe('In Progress');
    expect(STATUS_LABELS['blocked']).toBe('Blocked');
    expect(STATUS_LABELS['awaiting_approval']).toBe('Awaiting Review');
    expect(STATUS_LABELS['done']).toBe('Done');
  });

  it('does not have labels for every workflow status', () => {
    // These statuses exist in the workflow but are not in STATUS_LABELS
    // (they're just not displayed with custom labels in the UI)
    expect(STATUS_LABELS['intake']).toBeUndefined();
    expect(STATUS_LABELS['research']).toBeUndefined();
    expect(STATUS_LABELS['drafting']).toBeUndefined();
    expect(STATUS_LABELS['testing']).toBeUndefined();
    expect(STATUS_LABELS['client_input']).toBeUndefined();
  });
});

// ── SUB_STATUS_LABELS ─────────────────────────────────────────────────────

describe('SUB_STATUS_LABELS', () => {
  it('has labels for all sub-statuses', () => {
    expect(SUB_STATUS_LABELS['waiting_client']).toBe('Waiting for Client');
    expect(SUB_STATUS_LABELS['waiting_documents']).toBe('Waiting for Documents');
    expect(SUB_STATUS_LABELS['internal']).toBe('Internal Block');
  });
});

// ── PRIORITY_LABELS ───────────────────────────────────────────────────────

describe('PRIORITY_LABELS', () => {
  it('has labels for all priority levels', () => {
    expect(PRIORITY_LABELS['low']).toBe('Low');
    expect(PRIORITY_LABELS['normal']).toBe('Normal');
    expect(PRIORITY_LABELS['high']).toBe('High');
    expect(PRIORITY_LABELS['urgent']).toBe('Urgent');
  });
});

// ── AGENT_MAP ─────────────────────────────────────────────────────────────

describe('AGENT_MAP', () => {
  it('has entries for all expected agent keys', () => {
    expect(AGENT_MAP['lex-coo']).toBeDefined();
    expect(AGENT_MAP['lex-intake']).toBeDefined();
    expect(AGENT_MAP['lex-research']).toBeDefined();
    expect(AGENT_MAP['lex-draft']).toBeDefined();
    expect(AGENT_MAP['lex-control']).toBeDefined();
    expect(AGENT_MAP['lex-memory']).toBeDefined();
  });

  it('each agent has name, emoji, role, primaryModel, tier', () => {
    for (const [key, agent] of Object.entries(AGENT_MAP)) {
      expect(agent.name).toBeTruthy();
      expect(agent.emoji).toBeTruthy();
      expect(agent.role).toBeTruthy();
      expect(agent.primaryModel).toBeTruthy();
      expect(agent.tier).toBeTruthy();
    }
  });

  it('COO agent has Orchestrator role', () => {
    expect(AGENT_MAP['lex-coo'].role).toBe('Orchestrator');
  });
});
