import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { queryAll, queryOne, run } from './index';
import type { User, CreateUserRequest, UpdateUserRequest, UserRole } from '@/lib/types';

// Internal type that includes password_hash (from DB)
type UserWithPassword = User & { password_hash?: string };

const SALT_ROUNDS = 10;

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// List all users (admin only)
export function listUsers(options?: { role?: UserRole; is_active?: boolean }): User[] {
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params: string[] = [];

  if (options?.role) {
    sql += ' AND role = ?';
    params.push(options.role);
  }
  if (options?.is_active !== undefined) {
    sql += ' AND is_active = ?';
    params.push(options.is_active ? '1' : '0');
  }

  sql += ' ORDER BY created_at DESC';

  return queryAll<User>(sql, params);
}

// Get user by ID
export function getUser(id: string): User | undefined {
  return queryOne<User>('SELECT * FROM users WHERE id = ?', [id]);
}

// Get user by email
export function getUserByEmail(email: string): UserWithPassword | undefined {
  return queryOne<UserWithPassword>('SELECT * FROM users WHERE email = ?', [email]);
}

// Create user
export function createUser(data: CreateUserRequest): User {
  const id = uuidv4();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(data.password);

  run(
    `INSERT INTO users (id, email, password_hash, name, role, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, data.email, passwordHash, data.name, data.role, now, now]
  );

  return getUser(id)!;
}

// Update user
export function updateUser(id: string, data: UpdateUserRequest): User | undefined {
  const existing = getUser(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const params: string[] = [];

  if (data.email !== undefined) {
    updates.push('email = ?');
    params.push(data.email);
  }
  if (data.name !== undefined) {
    updates.push('name = ?');
    params.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    params.push(data.role);
  }
  if (data.is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(data.is_active ? '1' : '0');
  }
  if (data.password !== undefined) {
    updates.push('password_hash = ?');
    params.push(hashPassword(data.password));
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  return getUser(id);
}

// Delete user
export function deleteUser(id: string): boolean {
  const existing = getUser(id);
  if (!existing) return false;
  run('DELETE FROM users WHERE id = ?', [id]);
  return true;
}

// User authentication
export function authenticateUser(email: string, password: string): User | null {
  const user = getUserByEmail(email);
  if (!user || !user.is_active) return null;
  if (!verifyPassword(password, user.password_hash || '')) return null;

  // Update last login
  run('UPDATE users SET last_login = ? WHERE id = ?', [new Date().toISOString(), user.id]);
  return user;
}

// User-Client Access management
export function grantClientAccess(userId: string, clientId: string, grantedBy?: string): boolean {
  try {
    run(
      `INSERT OR REPLACE INTO user_client_access (user_id, client_id, granted_by, granted_at)
       VALUES (?, ?, ?, ?)`,
      [userId, clientId, grantedBy || null, new Date().toISOString()]
    );
    return true;
  } catch {
    return false;
  }
}

export function revokeClientAccess(userId: string, clientId: string): boolean {
  const result = run(
    'DELETE FROM user_client_access WHERE user_id = ? AND client_id = ?',
    [userId, clientId]
  );
  return result.changes > 0;
}

export function getUserClientIds(userId: string): string[] {
  const rows = queryAll<{ client_id: string }>(
    'SELECT client_id FROM user_client_access WHERE user_id = ?',
    [userId]
  );
  return rows.map(r => r.client_id);
}

// User-Project Access management
export function grantProjectAccess(userId: string, projectId: string, grantedBy?: string): boolean {
  try {
    run(
      `INSERT OR REPLACE INTO user_project_access (user_id, project_id, granted_by, granted_at)
       VALUES (?, ?, ?, ?)`,
      [userId, projectId, grantedBy || null, new Date().toISOString()]
    );
    return true;
  } catch {
    return false;
  }
}

export function revokeProjectAccess(userId: string, projectId: string): boolean {
  const result = run(
    'DELETE FROM user_project_access WHERE user_id = ? AND project_id = ?',
    [userId, projectId]
  );
  return result.changes > 0;
}

export function getUserProjectIds(userId: string): string[] {
  const rows = queryAll<{ project_id: string }>(
    'SELECT project_id FROM user_project_access WHERE user_id = ?',
    [userId]
  );
  return rows.map(r => r.project_id);
}

// RBAC: Check if user can access resource
export function canUserAccessClient(userId: string, clientId: string): boolean {
  const user = getUser(userId);
  if (!user) return false;

  // Admin can access everything
  if (user.role === 'admin') return true;

  // Check direct client access
  const access = queryOne<{ user_id: string }>(
    'SELECT user_id FROM user_client_access WHERE user_id = ? AND client_id = ?',
    [userId, clientId]
  );
  return !!access;
}

export function canUserAccessProject(userId: string, projectId: string): boolean {
  const user = getUser(userId);
  if (!user) return false;

  // Admin can access everything
  if (user.role === 'admin') return true;

  // Check direct project access
  const access = queryOne<{ user_id: string }>(
    'SELECT user_id FROM user_project_access WHERE user_id = ? AND project_id = ?',
    [userId, projectId]
  );
  if (access) return true;

  // Check if project is linked to any client the user has access to
  const clientProject = queryOne<{ client_id: string }>(
    'SELECT client_id FROM client_projects WHERE project_id = ? LIMIT 1',
    [projectId]
  );
  if (clientProject) {
    return canUserAccessClient(userId, clientProject.client_id);
  }

  return false;
}

export function canUserAccessTask(userId: string, taskId: string): boolean {
  const user = getUser(userId);
  if (!user) return false;

  // Admin can access everything
  if (user.role === 'admin') return true;

  // Get task with client/project
  const task = queryOne<{ client_id?: string; project_id?: string }>(
    'SELECT client_id, project_id FROM tasks WHERE id = ?',
    [taskId]
  );
  if (!task) return false;

  if (task.client_id && canUserAccessClient(userId, task.client_id)) return true;
  if (task.project_id && canUserAccessProject(userId, task.project_id)) return true;

  return false;
}
