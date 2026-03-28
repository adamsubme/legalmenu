'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { PRIORITY_COLORS, type TaskExt } from '../constants';
import { SUB_STATUS_LABELS, timeAgo } from '@/lib/utils';
import { Users } from 'lucide-react';

interface TaskCardProps {
  task: TaskExt;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  return (
    <div
      className={`rounded-lg border border-zinc-700 p-3 transition-all ${
        isDragging
          ? 'shadow-lg shadow-black/50 rotate-2 bg-zinc-800'
          : 'bg-zinc-800/50 hover:bg-zinc-800'
      }`}
    >
      <Link href={`/case/${task.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-2">{task.title}</p>
            {task.sub_status && (
              <Badge variant="secondary" className="mt-1 text-[10px]">
                {SUB_STATUS_LABELS[task.sub_status] || task.sub_status}
              </Badge>
            )}
          </div>
          {task.agent_avatar && (
            <span className="text-lg shrink-0">{task.agent_avatar}</span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          {task.priority && task.priority !== 'normal' && (
            <Badge className={`text-[10px] ${PRIORITY_COLORS[task.priority]}`}>
              {task.priority}
            </Badge>
          )}
          {task.assigned_agent && !task.agent_avatar && (
            <span className="text-xs text-zinc-500">{task.assigned_agent.name}</span>
          )}
          <span className="text-[10px] text-zinc-600 ml-auto">{timeAgo(task.updated_at)}</span>
        </div>

        {task.client_name && (
          <div className="flex items-center gap-1 mt-1 text-[10px] text-zinc-500">
            <Users className="h-3 w-3" />
            <span className="truncate">{task.client_name}</span>
          </div>
        )}
      </Link>
    </div>
  );
}
