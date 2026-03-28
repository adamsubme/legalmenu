'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useMissionControl } from './store';
import type { Agent, Task } from './types';

/**
 * Persisted UI preferences — survives page refresh.
 *
 * Only stores lightweight user preferences, NOT server data.
 * Server data (agents, tasks, messages) lives in memory
 * and is updated via SSE. Persisting it would cause stale data issues.
 */
interface PersistedPrefs {
  selectedBusiness: string;
  selectedAgentId: string | null;
  selectedTaskId: string | null;
}

interface PersistedPrefsState extends PersistedPrefs {
  setSelectedBusiness: (business: string) => void;
  setSelectedAgentId: (agentId: string | null) => void;
  setSelectedTaskId: (taskId: string | null) => void;
}

export const usePersistedPrefs = create<PersistedPrefsState>()(
  persist(
    (set) => ({
      selectedBusiness: 'all',
      selectedAgentId: null,
      selectedTaskId: null,

      setSelectedBusiness: (business) => set({ selectedBusiness: business }),
      setSelectedAgentId: (agentId) => set({ selectedAgentId: agentId }),
      setSelectedTaskId: (taskId) => set({ selectedTaskId: taskId }),
    }),
    {
      name: 'mc-ui-prefs',
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedPrefs => ({
        selectedBusiness: state.selectedBusiness,
        selectedAgentId: state.selectedAgentId,
        selectedTaskId: state.selectedTaskId,
      }),
    }
  )
);

/**
 * Hook to get/set selected agent with automatic persistence.
 * Use this instead of directly using useMissionControl for selections.
 */
export function useSelectedAgent(): [Agent | null, (agent: Agent | null) => void] {
  const { selectedAgentId, setSelectedAgentId } = usePersistedPrefs();
  const agents = useMissionControl((s) => s.agents);
  const setSelectedAgent = useMissionControl((s) => s.setSelectedAgent);

  const agent = selectedAgentId ? agents.find((a) => a.id === selectedAgentId) ?? null : null;

  const setAgent = (a: Agent | null) => {
    setSelectedAgentId(a?.id ?? null);
    setSelectedAgent(a);
  };

  return [agent, setAgent];
}

/**
 * Hook to get/set selected task with automatic persistence.
 * Use this instead of directly using useMissionControl for selections.
 */
export function useSelectedTask(): [Task | null, (task: Task | null) => void] {
  const { selectedTaskId, setSelectedTaskId } = usePersistedPrefs();
  const tasks = useMissionControl((s) => s.tasks);
  const setSelectedTask = useMissionControl((s) => s.setSelectedTask);

  const task = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) ?? null : null;

  const setTask = (t: Task | null) => {
    setSelectedTaskId(t?.id ?? null);
    setSelectedTask(t);
  };

  return [task, setTask];
}
