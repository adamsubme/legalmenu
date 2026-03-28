import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { CaseTimeline, CreateTimelineEventRequest, TimelineEventType } from '@/lib/types';

// List timeline events for a case
export function listTimeline(taskId: string, options?: {
  event_type?: TimelineEventType;
  limit?: number;
}): CaseTimeline[] {
  let sql = 'SELECT * FROM case_timeline WHERE task_id = ?';
  const params: string[] = [taskId];

  if (options?.event_type) {
    sql += ' AND event_type = ?';
    params.push(options.event_type);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  return queryAll<CaseTimeline>(sql, params);
}

// Get timeline event by ID
export function getTimelineEvent(id: string): CaseTimeline | undefined {
  return queryOne<CaseTimeline>('SELECT * FROM case_timeline WHERE id = ?', [id]);
}

// Create timeline event
export function createTimelineEvent(taskId: string, data: CreateTimelineEventRequest): CaseTimeline {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO case_timeline (id, task_id, event_type, actor_type, actor_id, actor_name, description, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      taskId,
      data.event_type,
      data.actor_type || null,
      data.actor_id || null,
      data.actor_name || null,
      data.description,
      data.metadata ? JSON.stringify(data.metadata) : null,
      now,
    ]
  );

  return getTimelineEvent(id)!;
}

// Delete timeline event (only if no related data)
export function deleteTimelineEvent(id: string): boolean {
  const existing = getTimelineEvent(id);
  if (!existing) return false;
  run('DELETE FROM case_timeline WHERE id = ?', [id]);
  return true;
}

// Convenience functions for common events
export function logCaseCreated(taskId: string, createdBy?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'created',
    actor_type: createdBy ? 'user' : 'system',
    actor_id: createdBy,
    actor_name: createdBy || 'System',
    description: 'Case created',
  });
}

export function logCaseAssigned(taskId: string, agentId: string, agentName: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'assigned',
    actor_type: 'agent',
    actor_id: agentId,
    actor_name: agentName,
    description: `Case assigned to ${agentName}`,
  });
}

export function logStatusChanged(taskId: string, oldStatus: string, newStatus: string, actorName?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'status_changed',
    actor_type: 'system',
    actor_name: actorName || 'System',
    description: `Status changed from ${oldStatus} to ${newStatus}`,
    metadata: JSON.stringify({ old_status: oldStatus, new_status: newStatus }),
  });
}

export function logBlocked(taskId: string, reason: string, actorName?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'blocked',
    actor_type: 'system',
    actor_name: actorName || 'System',
    description: `Case blocked: ${reason}`,
    metadata: { reason },
  });
}

export function logUnblocked(taskId: string, actorName?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'unblocked',
    actor_type: 'system',
    actor_name: actorName || 'System',
    description: 'Case unblocked',
  });
}

export function logDocumentAdded(taskId: string, documentTitle: string, addedBy?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'document_added',
    actor_type: addedBy ? 'user' : 'system',
    actor_id: addedBy,
    actor_name: addedBy || 'Agent',
    description: `Document added: ${documentTitle}`,
    metadata: { document_title: documentTitle },
  });
}

export function logCommentAdded(taskId: string, commentPreview: string, addedBy?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'comment_added',
    actor_type: addedBy ? 'user' : 'system',
    actor_id: addedBy,
    actor_name: addedBy || 'User',
    description: `Comment added: ${commentPreview.slice(0, 50)}...`,
  });
}

export function logClientLinked(taskId: string, clientName: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'client_linked',
    actor_type: 'system',
    description: `Client linked: ${clientName}`,
    metadata: { client_name: clientName },
  });
}

export function logProjectLinked(taskId: string, projectName: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'project_linked',
    actor_type: 'system',
    description: `Project linked: ${projectName}`,
    metadata: { project_name: projectName },
  });
}

export function logDeadlineSet(taskId: string, deadline: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'deadline_set',
    actor_type: 'system',
    description: `Deadline set: ${new Date(deadline).toLocaleDateString()}`,
    metadata: { deadline },
  });
}

export function logCaseCompleted(taskId: string, completedBy?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'completed',
    actor_type: completedBy ? 'user' : 'system',
    actor_id: completedBy,
    actor_name: completedBy || 'System',
    description: 'Case marked as completed',
  });
}

export function logEscalated(taskId: string, reason: string, escalatedBy?: string): CaseTimeline {
  return createTimelineEvent(taskId, {
    event_type: 'escalated',
    actor_type: escalatedBy ? 'user' : 'system',
    actor_id: escalatedBy,
    actor_name: escalatedBy || 'System',
    description: `Case escalated: ${reason}`,
    metadata: { reason },
  });
}

// Get timeline summary (for dashboard display)
export function getTimelineSummary(taskId: string): {
  total_events: number;
  by_type: Record<string, number>;
  last_event?: CaseTimeline;
} {
  const events = listTimeline(taskId, { limit: 100 });
  
  const byType: Record<string, number> = {};
  for (const event of events) {
    byType[event.event_type] = (byType[event.event_type] || 0) + 1;
  }

  return {
    total_events: events.length,
    by_type: byType,
    last_event: events[0],
  };
}
