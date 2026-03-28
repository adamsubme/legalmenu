'use client';

import { DragDropContext, type DropResult } from '@hello-pangea/dnd';
import { useCallback } from 'react';
import { WORKFLOW_STAGES, type TaskExt, type WorkflowStage, getTasksByStage, stageToStatus, stageToSubStatus } from '../constants';
import { KanbanColumn } from './kanban-column';
import { api } from '@/lib/api-client';

interface KanbanBoardProps {
  tasks: TaskExt[];
  onRefresh: () => void;
}

export function KanbanBoard({ tasks, onRefresh }: KanbanBoardProps) {
  const tasksByStage = getTasksByStage(tasks);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      if (!result.destination) return;

      const taskId = result.draggableId;
      const newStage = result.destination.droppableId as WorkflowStage;
      const newStatus = stageToStatus(newStage);
      const subStatus = stageToSubStatus(newStage);

      // Optimistic update
      onRefresh();

      try {
        await api.patch(`/tasks/${taskId}`, { status: newStatus, sub_status: subStatus });
      } catch {
        onRefresh();
      }
    },
    [onRefresh]
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 p-4 h-full min-w-max">
        {WORKFLOW_STAGES.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            tasks={tasksByStage[stage.id]}
          />
        ))}
      </div>
    </DragDropContext>
  );
}
