import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { Project, CreateProjectRequest, UpdateProjectRequest, ProjectStatus } from '@/lib/types';

// List all projects with optional filters
export function listProjects(options?: {
  search?: string;
  clientId?: string;
  status?: ProjectStatus;
}): Project[] {
  let sql = `
    SELECT p.*, c.name as client_name, c.email as client_email
    FROM projects p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE 1=1
  `;
  const params: string[] = [];

  if (options?.clientId) {
    sql += ' AND p.client_id = ?';
    params.push(options.clientId);
  }

  if (options?.status) {
    sql += ' AND p.status = ?';
    params.push(options.status);
  }

  if (options?.search) {
    sql += ' AND (p.name LIKE ? OR p.description LIKE ? OR p.tags LIKE ? OR p.project_type LIKE ?)';
    const s = `%${options.search}%`;
    params.push(s, s, s, s);
  }

  sql += ' ORDER BY p.created_at DESC';

  return queryAll<Project & { client_name?: string; client_email?: string }>(sql, params);
}

// Get project by ID
export function getProject(id: string): (Project & { client_name?: string; client_email?: string }) | undefined {
  return queryOne<Project & { client_name?: string; client_email?: string }>(
    `SELECT p.*, c.name as client_name, c.email as client_email
     FROM projects p
     LEFT JOIN clients c ON p.client_id = c.id
     WHERE p.id = ?`,
    [id]
  );
}

// Get projects by client ID
export function findProjectsByClient(clientId: string): Project[] {
  return queryAll<Project>(
    'SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC',
    [clientId]
  );
}

// Create a new project
export function createProject(data: CreateProjectRequest): Project {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO projects (id, name, description, status, client_id, project_type, tags, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.description || null,
      data.status || 'active',
      data.client_id || null,
      data.project_type || null,
      data.tags || null,
      now,
      now,
    ]
  );

  return getProject(id)!;
}

// Update project
export function updateProject(id: string, data: UpdateProjectRequest): Project | undefined {
  const existing = getProject(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();

  run(
    `UPDATE projects SET
       name = COALESCE(?, name),
       description = COALESCE(?, description),
       status = COALESCE(?, status),
       client_id = COALESCE(?, client_id),
       project_type = COALESCE(?, project_type),
       tags = COALESCE(?, tags),
       updated_at = ?
     WHERE id = ?`,
    [
      data.name || null,
      data.description !== undefined ? data.description : null,
      data.status !== undefined ? data.status : null,
      data.client_id !== undefined ? data.client_id : null,
      data.project_type !== undefined ? data.project_type : null,
      data.tags !== undefined ? data.tags : null,
      now,
      id,
    ]
  );

  return getProject(id);
}

// Delete project
export function deleteProject(id: string): boolean {
  const existing = getProject(id);
  if (!existing) return false;

  run('DELETE FROM projects WHERE id = ?', [id]);
  return true;
}

// Get or create default project (for tasks without a project)
export function getOrCreateDefaultProject(): Project {
  const defaultProject = queryOne<Project>(
    "SELECT * FROM projects WHERE name = 'Default Project' LIMIT 1"
  );

  if (defaultProject) return defaultProject;

  return createProject({
    name: 'Default Project',
    description: 'Default project for tasks without specific project',
    status: 'active',
  });
}

// Get project statistics
export function getProjectStats(id: string): { task_count: number; active_task_count: number } {
  const taskCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM tasks WHERE project_id = ?',
    [id]
  );
  const activeTaskCount = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status NOT IN ('done', 'cancelled')",
    [id]
  );

  return {
    task_count: taskCount?.count || 0,
    active_task_count: activeTaskCount?.count || 0,
  };
}
