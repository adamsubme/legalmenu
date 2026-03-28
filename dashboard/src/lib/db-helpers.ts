/**
 * Database Helper Utilities
 * 
 * Common database operations to reduce duplication across API routes.
 * Follows DRY principle for frequent patterns like ID generation, 
 * timestamps, and event logging.
 */

import { v4 as uuidv4 } from 'uuid';
import { run, queryOne } from './db';
import { broadcast } from './events';
import type { Agent, Event, TaskActivity } from './types';

/**
 * Generate a new UUID v4
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Get current ISO timestamp
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Insert an event into the events table and broadcast via SSE
 */
export function insertEvent(params: {
  type: string;
  message: string;
  agentId?: string | null;
  taskId?: string | null;
  metadata?: string | null;
}): string {
  const { type, message, agentId, taskId, metadata } = params;
  const id = generateId();
  const now = timestamp();

  run(
    `INSERT INTO events (id, type, agent_id, task_id, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, type, agentId ?? null, taskId ?? null, message, metadata ?? null, now]
  );

  // Broadcast to SSE clients
  broadcast({
    type: 'event_added',
    payload: {
      id,
      type,
      task_id: taskId ?? undefined,
      message,
      created_at: now,
    },
  });

  return id;
}

/**
 * Insert a task activity into task_activities table
 */
export function insertActivity(params: {
  taskId: string;
  activityType: string;
  message: string;
  agentId?: string | null;
  metadata?: string | null;
}): string {
  const { taskId, activityType, message, agentId, metadata } = params;
  const id = generateId();
  const now = timestamp();

  run(
    `INSERT INTO task_activities (id, task_id, agent_id, activity_type, message, metadata, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, taskId, agentId ?? null, activityType, message, metadata ?? null, now]
  );

  return id;
}

/**
 * Update task status and broadcast the change
 */
export function updateTaskStatus(taskId: string, status: string): void {
  const now = timestamp();
  run('UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?', [status, now, taskId]);
}

/**
 * Update agent status
 */
export function updateAgentStatus(agentId: string, status: string): void {
  const now = timestamp();
  run('UPDATE agents SET status = ?, updated_at = ? WHERE id = ?', [status, now, agentId]);
}

/**
 * Get agent by ID with type safety
 */
export function getAgentById(id: string): Agent | undefined {
  return queryOne<Agent>('SELECT * FROM agents WHERE id = ?', [id]);
}

/**
 * Get agent by name with type safety
 */
export function getAgentByName(name: string): Agent | undefined {
  return queryOne<Agent>('SELECT * FROM agents WHERE name = ?', [name]);
}

/**
 * Build a task query with agent joins
 * Returns SQL and params for common task query pattern
 */
export function buildTaskQuery(whereClause: string = '1=1'): { sql: string; countSql: string } {
  const baseSelect = `
    SELECT t.*,
      aa.name as assigned_agent_name,
      aa.avatar_emoji as assigned_agent_emoji,
      ca.name as created_by_agent_name,
      ca.avatar_emoji as created_by_agent_emoji
    FROM tasks t
    LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
    LEFT JOIN agents ca ON t.created_by_agent_id = ca.id
  `;
  
  const baseCount = `
    SELECT COUNT(*) as total
    FROM tasks t
    LEFT JOIN agents aa ON t.assigned_agent_id = aa.id
    LEFT JOIN agents ca ON t.created_by_agent_id = ca.id
  `;

  return {
    sql: `${baseSelect} WHERE ${whereClause}`,
    countSql: `${baseCount} WHERE ${whereClause}`,
  };
}

/**
 * Transform task row with agent info into nested structure
 */
export function transformTaskWithAgent<T extends { 
  assigned_agent_id?: string | null; 
  assigned_agent_name?: string | null;
  assigned_agent_emoji?: string | null;
}>(task: T): T & { assigned_agent?: { id: string; name: string; avatar_emoji?: string } | undefined } {
  return {
    ...task,
    assigned_agent: task.assigned_agent_id && task.assigned_agent_name
      ? {
          id: task.assigned_agent_id,
          name: task.assigned_agent_name,
          avatar_emoji: task.assigned_agent_emoji ?? undefined,
        }
      : undefined,
  };
}
