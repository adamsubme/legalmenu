'use client';

import { Droppable, Draggable } from '@hello-pangea/dnd';
import { type WorkflowStageConfig, type TaskExt } from '../constants';
import { TaskCard } from './task-card';
import { Badge } from '@/components/ui/badge';

interface KanbanColumnProps {
  stage: WorkflowStageConfig;
  tasks: TaskExt[];
}

export function KanbanColumn({ stage, tasks }: KanbanColumnProps) {
  const StageIcon = stage.icon;

  return (
    <div className="flex flex-col w-72 shrink-0">
      {/* Column Header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg border-t-2 ${stage.color} bg-zinc-900/50`}>
        <StageIcon className="h-4 w-4" />
        <span className="font-medium text-sm">{stage.label}</span>
        <Badge variant="outline" className="ml-auto text-xs">{tasks.length}</Badge>
      </div>

      {/* Column Content */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`flex-1 rounded-b-lg p-2 space-y-2 min-h-32 transition-colors ${
              snapshot.isDraggingOver ? 'bg-zinc-800/50' : 'bg-zinc-900/20'
            }`}
          >
            {tasks.map((task, index) => (
              <Draggable key={task.id} draggableId={task.id} index={index}>
                {(dragProvided, dragSnapshot) => (
                  <div
                    ref={dragProvided.innerRef}
                    {...dragProvided.draggableProps}
                    {...dragProvided.dragHandleProps}
                  >
                    <TaskCard
                      task={task}
                      isDragging={dragSnapshot.isDragging}
                    />
                  </div>
                )}
              </Draggable>
            ))}
            {provided.placeholder}

            {tasks.length === 0 && !snapshot.isDraggingOver && (
              <div className="h-24 flex items-center justify-center text-xs text-zinc-600">
                Drop cases here
              </div>
            )}
          </div>
        )}
      </Droppable>
    </div>
  );
}
