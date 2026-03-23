import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function timeAgo(date: string | Date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export const STATUS_LABELS: Record<string, string> = {
  not_started: 'New',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  awaiting_approval: 'Awaiting Review',
  done: 'Done',
};

export const SUB_STATUS_LABELS: Record<string, string> = {
  waiting_client: 'Waiting for Client',
  waiting_documents: 'Waiting for Documents',
  internal: 'Internal Block',
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const AGENT_MAP: Record<string, { name: string; emoji: string; role: string; primaryModel: string; tier: string }> = {
  'lex-coo': { name: 'Lex COO', emoji: '⚖️', role: 'Orchestrator', primaryModel: 'Gemini 3.0', tier: 'balanced' },
  'lex-intake': { name: 'Lex Intake', emoji: '📋', role: 'Intake', primaryModel: 'GLM-5', tier: 'workhorse' },
  'lex-research': { name: 'Lex Research', emoji: '🔍', role: 'Research', primaryModel: 'GLM-5', tier: 'workhorse' },
  'lex-draft': { name: 'Lex Draft', emoji: '✍️', role: 'Drafting', primaryModel: 'GLM-5', tier: 'workhorse' },
  'lex-control': { name: 'Lex Control', emoji: '🛡️', role: 'Compliance', primaryModel: 'MiniMax M2.5', tier: 'budget' },
  'lex-memory': { name: 'Lex Memory', emoji: '🧠', role: 'Knowledge', primaryModel: 'MiniMax M2.5', tier: 'budget' },
};

export const WORKFLOW_STAGES = [
  { id: 'new', label: 'New', color: 'bg-zinc-500' },
  { id: 'intake', label: 'Intake', color: 'bg-blue-500' },
  { id: 'research', label: 'Research', color: 'bg-purple-500' },
  { id: 'draft', label: 'Draft', color: 'bg-amber-500' },
  { id: 'review', label: 'Review', color: 'bg-cyan-500' },
  { id: 'done', label: 'Done', color: 'bg-emerald-500' },
];
