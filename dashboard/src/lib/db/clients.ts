import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { Client, CreateClientRequest, UpdateClientRequest } from '@/lib/types';

export interface ClientWithStats extends Client {
  project_count?: number;
  task_count?: number;
  active_task_count?: number;
}

// List all clients
export function listClients(search?: string): Client[] {
  let sql = 'SELECT * FROM clients WHERE 1=1';
  const params: string[] = [];

  if (search) {
    sql += ' AND (name LIKE ? OR email LIKE ? OR telegram_username LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  sql += ' ORDER BY name ASC';

  return queryAll<Client>(sql, params);
}

// Get client by ID
export function getClient(id: string): Client | undefined {
  return queryOne<Client>('SELECT * FROM clients WHERE id = ?', [id]);
}

// Get client by telegram ID
export function findClientByTelegramId(telegramId: string): Client | undefined {
  return queryOne<Client>('SELECT * FROM clients WHERE telegram_id = ?', [telegramId]);
}

// Get client by email
export function findClientByEmail(email: string): Client | undefined {
  return queryOne<Client>('SELECT * FROM clients WHERE email = ?', [email]);
}

// Create a new client
export function createClient(data: CreateClientRequest): Client {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO clients (id, name, email, phone, telegram_id, telegram_username, contact_info, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.name,
      data.email || null,
      data.phone || null,
      data.telegram_id || null,
      data.telegram_username || null,
      data.contact_info || null,
      data.notes || null,
      now,
      now,
    ]
  );

  return getClient(id)!;
}

// Update client
export function updateClient(id: string, data: UpdateClientRequest): Client | undefined {
  const existing = getClient(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();

  run(
    `UPDATE clients SET
       name = COALESCE(?, name),
       email = COALESCE(?, email),
       phone = COALESCE(?, phone),
       telegram_id = COALESCE(?, telegram_id),
       telegram_username = COALESCE(?, telegram_username),
       contact_info = COALESCE(?, contact_info),
       notes = COALESCE(?, notes),
       updated_at = ?
     WHERE id = ?`,
    [
      data.name || null,
      data.email !== undefined ? data.email : null,
      data.phone !== undefined ? data.phone : null,
      data.telegram_id !== undefined ? data.telegram_id : null,
      data.telegram_username !== undefined ? data.telegram_username : null,
      data.contact_info !== undefined ? data.contact_info : null,
      data.notes !== undefined ? data.notes : null,
      now,
      id,
    ]
  );

  return getClient(id);
}

// Delete client
export function deleteClient(id: string): boolean {
  const existing = getClient(id);
  if (!existing) return false;

  run('DELETE FROM clients WHERE id = ?', [id]);
  return true;
}

// Get or create client by telegram ID
export function getOrCreateClientByTelegram(
  telegramId: string,
  telegramUsername?: string
): Client {
  const existing = findClientByTelegramId(telegramId);
  if (existing) {
    // Update username if provided and different
    if (telegramUsername && existing.telegram_username !== telegramUsername) {
      updateClient(existing.id, { telegram_username: telegramUsername });
    }
    return getClient(existing.id)!;
  }

  // Create new client with telegram info
  return createClient({
    name: telegramUsername ? `@${telegramUsername}` : `Client ${telegramId.slice(0, 8)}`,
    telegram_id: telegramId,
    telegram_username: telegramUsername,
  });
}

// Get client statistics
export function getClientStats(id: string): { project_count: number; task_count: number; active_task_count: number } {
  const projectCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM projects WHERE client_id = ?',
    [id]
  );
  const taskCount = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM tasks WHERE client_id = ?',
    [id]
  );
  const activeTaskCount = queryOne<{ count: number }>(
    "SELECT COUNT(*) as count FROM tasks WHERE client_id = ? AND status NOT IN ('done', 'cancelled')",
    [id]
  );

  return {
    project_count: projectCount?.count || 0,
    task_count: taskCount?.count || 0,
    active_task_count: activeTaskCount?.count || 0,
  };
}
