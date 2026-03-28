import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { AgentMemory, CreateAgentMemoryRequest, MemoryType } from '@/lib/types';

// List memories for an agent
export function listAgentMemories(agentId: string, options?: {
  memory_type?: MemoryType;
  search?: string;
  tags?: string[];
}): AgentMemory[] {
  let sql = 'SELECT * FROM agent_memory WHERE agent_id = ?';
  const params: string[] = [agentId];

  if (options?.memory_type) {
    sql += ' AND memory_type = ?';
    params.push(options.memory_type);
  }

  if (options?.search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    const s = `%${options.search}%`;
    params.push(s, s);
  }

  if (options?.tags && options.tags.length > 0) {
    const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
    sql += ` AND (${tagConditions})`;
    options.tags.forEach(tag => params.push(`%${tag}%`));
  }

  sql += ' ORDER BY created_at DESC';

  return queryAll<AgentMemory>(sql, params);
}

// Get memory by ID
export function getAgentMemory(id: string): AgentMemory | undefined {
  return queryOne<AgentMemory>('SELECT * FROM agent_memory WHERE id = ?', [id]);
}

// Create memory
export function createAgentMemory(agentId: string, data: CreateAgentMemoryRequest): AgentMemory {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO agent_memory (id, agent_id, memory_type, title, content, file_path, file_name, file_size, file_mime, url, tags, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      agentId,
      data.memory_type,
      data.title,
      data.content || null,
      data.file_path || null,
      data.file_name || null,
      data.file_size || null,
      data.file_mime || null,
      data.url || null,
      data.tags || null,
      null, // created_by
      now,
      now,
    ]
  );

  return getAgentMemory(id)!;
}

// Update memory
export function updateAgentMemory(id: string, data: Partial<CreateAgentMemoryRequest>): AgentMemory | undefined {
  const existing = getAgentMemory(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const params: string[] = [];

  if (data.title !== undefined) {
    updates.push('title = ?');
    params.push(data.title);
  }
  if (data.content !== undefined) {
    updates.push('content = ?');
    params.push(data.content);
  }
  if (data.memory_type !== undefined) {
    updates.push('memory_type = ?');
    params.push(data.memory_type);
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(data.tags);
  }
  if (data.url !== undefined) {
    updates.push('url = ?');
    params.push(data.url);
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  run(`UPDATE agent_memory SET ${updates.join(', ')} WHERE id = ?`, params);
  return getAgentMemory(id);
}

// Delete memory
export function deleteAgentMemory(id: string): boolean {
  const existing = getAgentMemory(id);
  if (!existing) return false;
  run('DELETE FROM agent_memory WHERE id = ?', [id]);
  return true;
}

// Get memories by type (for quick access)
export function getAgentLessons(agentId: string): AgentMemory[] {
  return listAgentMemories(agentId, { memory_type: 'lesson' });
}

export function getAgentPrecedents(agentId: string): AgentMemory[] {
  return listAgentMemories(agentId, { memory_type: 'precedent' });
}

export function getAgentTemplates(agentId: string): AgentMemory[] {
  return listAgentMemories(agentId, { memory_type: 'template' });
}

// Add file to agent memory
export function addFileToAgentMemory(
  agentId: string,
  file: { path: string; name: string; size: number; mime: string },
  title: string,
  tags?: string[]
): AgentMemory {
  return createAgentMemory(agentId, {
    memory_type: 'file',
    title,
    file_path: file.path,
    file_name: file.name,
    file_size: file.size,
    file_mime: file.mime,
    tags: tags?.join(','),
  });
}

// Add URL to agent memory
export function addUrlToAgentMemory(
  agentId: string,
  url: string,
  title: string,
  tags?: string[]
): AgentMemory {
  return createAgentMemory(agentId, {
    memory_type: 'precedent',
    title,
    url,
    tags: tags?.join(','),
  });
}

// Get memory count by type
export function getAgentMemoryStats(agentId: string): Record<MemoryType, number> {
  const memories = listAgentMemories(agentId);
  const stats: Record<MemoryType, number> = {
    file: 0,
    lesson: 0,
    precedent: 0,
    template: 0,
    note: 0,
  };

  for (const memory of memories) {
    stats[memory.memory_type] = (stats[memory.memory_type] || 0) + 1;
  }

  return stats;
}
