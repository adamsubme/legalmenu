import { Bot, FileSearch, PenTool, Eye, MessageCircle, CheckCircle2 } from 'lucide-react';
import type { Task } from '@/lib/types';

export type WorkflowStage = 'intake' | 'research' | 'drafting' | 'review' | 'client_input' | 'done';

export interface WorkflowStageConfig {
  id: WorkflowStage;
  label: string;
  icon: typeof Bot;
  color: string;
  dot: string;
}

export const WORKFLOW_STAGES: WorkflowStageConfig[] = [
  { id: 'intake', label: 'Intake', icon: Bot, color: 'border-t-slate-500', dot: 'bg-slate-400' },
  { id: 'research', label: 'Research', icon: FileSearch, color: 'border-t-blue-500', dot: 'bg-blue-400' },
  { id: 'drafting', label: 'Drafting', icon: PenTool, color: 'border-t-purple-500', dot: 'bg-purple-400' },
  { id: 'review', label: 'Internal Review', icon: Eye, color: 'border-t-amber-500', dot: 'bg-amber-400' },
  { id: 'client_input', label: 'Client Input', icon: MessageCircle, color: 'border-t-cyan-500', dot: 'bg-cyan-400' },
  { id: 'done', label: 'Done', icon: CheckCircle2, color: 'border-t-emerald-500', dot: 'bg-emerald-400' },
] as const;

export const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/30',
  high: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export const SUB_STATUS_GROUPS: Record<string, { label: string; stages: WorkflowStage[] }> = {
  intake: { label: 'Intake', stages: ['intake'] },
  needs_research: { label: 'Needs Research', stages: ['research'] },
  research_in_progress: { label: 'Research in Progress', stages: ['research'] },
  needs_draft: { label: 'Needs Draft', stages: ['drafting'] },
  drafting_in_progress: { label: 'Drafting in Progress', stages: ['drafting'] },
  needs_review: { label: 'Needs Review', stages: ['review'] },
  review_in_progress: { label: 'Review in Progress', stages: ['review'] },
  needs_client_input: { label: 'Needs Client Input', stages: ['client_input'] },
  client_responded: { label: 'Client Responded', stages: ['drafting'] },
  approved: { label: 'Approved', stages: ['done'] },
  delivered: { label: 'Delivered', stages: ['done'] },
};

export type TaskExt = Task & {
  sub_status?: string | null;
  agent_name?: string;
  agent_avatar?: string;
  client_name?: string;
};

export function getStageFromTask(task: TaskExt): WorkflowStage {
  if (task.status === 'done') return 'done';

  if (task.sub_status) {
    const group = SUB_STATUS_GROUPS[task.sub_status];
    if (group) return group.stages[0];

    if (task.sub_status.includes('intake')) return 'intake';
    if (task.sub_status.includes('research')) return 'research';
    if (task.sub_status.includes('draft')) return 'drafting';
    if (task.sub_status.includes('review')) return 'review';
    if (task.sub_status.includes('client') || task.sub_status.includes('waiting')) return 'client_input';
  }

  switch (task.status) {
    case 'blocked': return 'review';
    case 'awaiting_approval': return 'client_input';
    case 'in_progress': return 'drafting';
    default: return 'intake';
  }
}

export function getTasksByStage(tasks: TaskExt[]): Record<WorkflowStage, TaskExt[]> {
  const grouped: Record<WorkflowStage, TaskExt[]> = {
    intake: [],
    research: [],
    drafting: [],
    review: [],
    client_input: [],
    done: [],
  };

  for (const task of tasks) {
    const stage = getStageFromTask(task);
    grouped[stage].push(task);
  }

  return grouped;
}

export function stageToStatus(stage: WorkflowStage): string {
  if (stage === 'done') return 'done';
  if (stage === 'client_input') return 'awaiting_approval';
  return 'in_progress';
}

export function stageToSubStatus(stage: WorkflowStage): string {
  switch (stage) {
    case 'intake': return 'intake';
    case 'research': return 'research_in_progress';
    case 'drafting': return 'drafting_in_progress';
    case 'review': return 'needs_review';
    case 'client_input': return 'needs_client_input';
    case 'done': return 'approved';
  }
}
