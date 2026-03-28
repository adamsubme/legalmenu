/**
 * Shared database queries for Mission Control.
 *
 * Centralises all SQL with JOINs so that:
 *  - Schema changes require editing in one place
 *  - JOIN logic is consistent across all consumers
 *  - TypeScript types are co-located with the query
 */

import { queryAll, queryOne } from './index';

// ── Task types (flattened result of task JOINs) ────────────────────────────────

export interface TaskRow {
  // Task columns
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  sub_status: string | null;
  assigned_agent_id: string | null;
  created_by_agent_id: string | null;
  workspace_id: string;
  business_id: string;
  due_date: string | null;
  notion_page_id: string | null;
  notion_last_synced: string | null;
  source: string | null;
  planning_session_key: string | null;
  planning_complete: number;
  planning_messages: string | null;
  planning_spec: string | null;
  planning_agents: string | null;
  client_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined columns
  assigned_agent_name: string | null;
  assigned_agent_emoji: string | null;
  created_by_agent_name: string | null;
  created_by_agent_emoji: string | null;
  client_name: string | null;
  project_name: string | null;
  workspace_name: string | null;
}

// ── Base SELECT with all standard JOINs ─────────────────────────────────────────

const TASK_SELECT = `
  SELECT
    t.*,
    aa.name        as assigned_agent_name,
    aa.avatar_emoji as assigned_agent_emoji,
    ca.name        as created_by_agent_name,
    ca.avatar_emoji as created_by_agent_emoji,
    cl.name        as client_name,
    pr.name        as project_name,
    ws.name        as workspace_name
  FROM tasks t
  LEFT JOIN agents   aa ON t.assigned_agent_id  = aa.id
  LEFT JOIN agents   ca ON t.created_by_agent_id = ca.id
  LEFT JOIN clients  cl ON t.client_id           = cl.id
  LEFT JOIN projects pr ON t.project_id          = pr.id
  LEFT JOIN workspaces ws ON t.workspace_id     = ws.id
`;

// ── Query builders ──────────────────────────────────────────────────────────────

export function listTasks(filters?: {
  status?: string | string[];
  businessId?: string;
  workspaceId?: string;
  assignedAgentId?: string;
  clientId?: string;
  projectId?: string;
  limit?: number;
  offset?: number;
}): TaskRow[] {
  let sql = TASK_SELECT;
  const params: unknown[] = [];
  const conditions: string[] = ['(t.source = \'mc\' OR t.source IS NULL)'];

  if (filters?.status) {
    const statuses = Array.isArray(filters.status)
      ? filters.status
      : filters.status.split(',').map(s => s.trim()).filter(Boolean);
    if (statuses.length === 1) {
      conditions.push('t.status = ?');
      params.push(statuses[0]);
    } else if (statuses.length > 1) {
      conditions.push(`t.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }

  if (filters?.businessId) {
    conditions.push('t.business_id = ?');
    params.push(filters.businessId);
  }

  if (filters?.workspaceId) {
    conditions.push('t.workspace_id = ?');
    params.push(filters.workspaceId);
  }

  if (filters?.assignedAgentId) {
    conditions.push('t.assigned_agent_id = ?');
    params.push(filters.assignedAgentId);
  }

  if (filters?.clientId) {
    conditions.push('t.client_id = ?');
    params.push(filters.clientId);
  }

  if (filters?.projectId) {
    conditions.push('t.project_id = ?');
    params.push(filters.projectId);
  }

  sql += ' WHERE ' + conditions.join(' AND ');
  sql += ' ORDER BY t.created_at DESC';

  if (filters?.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }
  if (filters?.offset) {
    sql += ' OFFSET ?';
    params.push(filters.offset);
  }

  return queryAll<TaskRow>(sql, params);
}

export function getTaskById(id: string): TaskRow | undefined {
  return queryOne<TaskRow>(`${TASK_SELECT} WHERE t.id = ?`, [id]);
}
