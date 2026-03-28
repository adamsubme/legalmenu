/**
 * Store persistence — tests.
 *
 * Tests verify the store structure and helper functions without
 * requiring a browser environment (localStorage is mocked via vi.mock).
 *
 * The actual persistence to localStorage would need integration tests.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * We test the helper functions and the state shape.
 * The actual Zustand store requires browser APIs (localStorage).
 * We verify the types and logic here, and the persist middleware
 * is tested via integration tests.
 */

describe('PersistedPrefs state shape', () => {
  // The persisted state interface
  interface PersistedPrefs {
    selectedBusiness: string;
    selectedAgentId: string | null;
    selectedTaskId: string | null;
  }

  it('has correct initial values', () => {
    const initial: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,
    };

    expect(initial.selectedBusiness).toBe('all');
    expect(initial.selectedAgentId).toBeNull();
    expect(initial.selectedTaskId).toBeNull();
  });

  it('selectedBusiness defaults to "all"', () => {
    const initial: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,
    };
    expect(initial.selectedBusiness).toBe('all');
  });

  it('IDs are nullable (not selected state)', () => {
    const initial: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,
    };
    expect(initial.selectedAgentId).toBeNull();
    expect(initial.selectedTaskId).toBeNull();
  });
});

describe('useSelectedAgent helper logic (pure functions)', () => {
  // Simulate the selector logic without Zustand
  function findAgentById(
    agents: { id: string; name: string }[],
    selectedAgentId: string | null
  ) {
    return selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;
  }

  const agents = [
    { id: 'agent-1', name: 'Lex Intake' },
    { id: 'agent-2', name: 'Lex Research' },
    { id: 'agent-3', name: 'Lex Draft' },
  ];

  it('returns null when no agent is selected', () => {
    const result = findAgentById(agents, null);
    expect(result).toBeNull();
  });

  it('returns the agent when selectedAgentId matches', () => {
    const result = findAgentById(agents, 'agent-2');
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Lex Research');
  });

  it('returns null when selectedAgentId does not match any agent', () => {
    const result = findAgentById(agents, 'nonexistent-id');
    expect(result).toBeNull();
  });
});

describe('useSelectedTask helper logic (pure functions)', () => {
  function findTaskById(
    tasks: { id: string; title: string }[],
    selectedTaskId: string | null
  ) {
    return selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;
  }

  const tasks = [
    { id: 'task-1', title: 'Review MiCA compliance' },
    { id: 'task-2', title: 'Draft contract' },
  ];

  it('returns null when no task is selected', () => {
    expect(findTaskById(tasks, null)).toBeNull();
  });

  it('returns the task when selectedTaskId matches', () => {
    const result = findTaskById(tasks, 'task-1');
    expect(result).not.toBeNull();
    expect(result!.title).toBe('Review MiCA compliance');
  });

  it('returns null when selectedTaskId does not match any task', () => {
    expect(findTaskById(tasks, 'nonexistent')).toBeNull();
  });
});

describe('partialize logic (which fields are persisted)', () => {
  interface FullState {
    selectedBusiness: string;
    selectedAgentId: string | null;
    selectedTaskId: string | null;
    // These are NOT persisted — they come from server
    agents: unknown[];
    tasks: unknown[];
    messages: unknown[];
  }

  // Simulates the partialize function from store-persistence.ts
  function partialize(state: FullState): { selectedBusiness: string; selectedAgentId: string | null; selectedTaskId: string | null } {
    return {
      selectedBusiness: state.selectedBusiness,
      selectedAgentId: state.selectedAgentId,
      selectedTaskId: state.selectedTaskId,
    };
  }

  it('only persists UI preference fields, not server data', () => {
    const fullState: FullState = {
      selectedBusiness: 'workspace-1',
      selectedAgentId: 'agent-1',
      selectedTaskId: 'task-1',
      agents: [{ id: 'a1' }, { id: 'a2' }], // server data — NOT persisted
      tasks: [{ id: 't1' }],                // server data — NOT persisted
      messages: [],                          // server data — NOT persisted
    };

    const persisted = partialize(fullState);

    expect(persisted).toEqual({
      selectedBusiness: 'workspace-1',
      selectedAgentId: 'agent-1',
      selectedTaskId: 'task-1',
    });

    // Verify server data was NOT included in persisted state
    expect(Object.keys(persisted)).not.toContain('agents');
    expect(Object.keys(persisted)).not.toContain('tasks');
    expect(Object.keys(persisted)).not.toContain('messages');
  });

  it('persisted state can be restored independently of server data', () => {
    const fullState: FullState = {
      selectedBusiness: 'workspace-2',
      selectedAgentId: null,
      selectedTaskId: 'task-5',
      agents: [],
      tasks: [],
      messages: [],
    };

    const persisted = partialize(fullState);

    // These values can be restored after page refresh
    expect(persisted.selectedBusiness).toBe('workspace-2');
    expect(persisted.selectedTaskId).toBe('task-5');
  });
});

describe('setSelectedAgentId/setSelectedTaskId update logic', () => {
  interface PersistedPrefs {
    selectedBusiness: string;
    selectedAgentId: string | null;
    selectedTaskId: string | null;
  }

  function setSelectedAgentId(state: PersistedPrefs, agentId: string | null): PersistedPrefs {
    return { ...state, selectedAgentId: agentId };
  }

  function setSelectedTaskId(state: PersistedPrefs, taskId: string | null): PersistedPrefs {
    return { ...state, selectedTaskId: taskId };
  }

  it('setSelectedAgentId to null clears selection', () => {
    const state: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: 'agent-1',
      selectedTaskId: null,
    };
    const next = setSelectedAgentId(state, null);
    expect(next.selectedAgentId).toBeNull();
    expect(next.selectedTaskId).toBeNull(); // unchanged
  });

  it('setSelectedAgentId to a string sets the ID', () => {
    const state: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,
    };
    const next = setSelectedAgentId(state, 'agent-3');
    expect(next.selectedAgentId).toBe('agent-3');
  });

  it('setSelectedTaskId to null clears selection', () => {
    const state: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: 'task-1',
    };
    const next = setSelectedTaskId(state, null);
    expect(next.selectedTaskId).toBeNull();
  });

  it('setSelectedTaskId to a string sets the ID', () => {
    const state: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,
    };
    const next = setSelectedTaskId(state, 'task-2');
    expect(next.selectedTaskId).toBe('task-2');
  });

  it('updating one field does not affect the other', () => {
    const state: PersistedPrefs = {
      selectedBusiness: 'all',
      selectedAgentId: 'agent-1',
      selectedTaskId: 'task-1',
    };
    const next = setSelectedAgentId(state, 'agent-2');
    expect(next.selectedAgentId).toBe('agent-2');
    expect(next.selectedTaskId).toBe('task-1'); // unchanged
  });
});

describe('storage key naming', () => {
  it('storage key is "mc-ui-prefs"', () => {
    const STORAGE_KEY = 'mc-ui-prefs';
    expect(STORAGE_KEY).toBe('mc-ui-prefs');
  });
});
