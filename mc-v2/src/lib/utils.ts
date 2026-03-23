import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'teraz';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m temu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h temu`;
  return `${Math.floor(seconds / 86400)}d temu`;
}

export const WORKFLOW_STAGES = [
  { id: 'not_started', label: 'Nowa', color: 'bg-zinc-500' },
  { id: 'in_progress', label: 'W toku', color: 'bg-blue-500' },
  { id: 'blocked', label: 'Zablokowana', color: 'bg-red-500' },
  { id: 'awaiting_approval', label: 'Do akceptacji', color: 'bg-amber-500' },
  { id: 'done', label: 'Zamknięta', color: 'bg-emerald-500' },
] as const;

export const AGENT_MAP: Record<string, { name: string; emoji: string; role: string; model: string }> = {
  'lex-coo': { name: 'Lex COO', emoji: '⚖️', role: 'Orchestrator', model: 'Gemini 3.0' },
  'lex-intake': { name: 'Lex Intake', emoji: '📋', role: 'Intake', model: 'GLM-5' },
  'lex-research': { name: 'Lex Research', emoji: '🔍', role: 'Research', model: 'GLM-5' },
  'lex-draft': { name: 'Lex Draft', emoji: '✍️', role: 'Drafting', model: 'GLM-5' },
  'lex-control': { name: 'Lex Control', emoji: '🛡️', role: 'Compliance', model: 'MiniMax M2.5' },
  'lex-memory': { name: 'Lex Memory', emoji: '🧠', role: 'Knowledge', model: 'MiniMax M2.5' },
};
