import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { KnowledgeEntry, CreateKnowledgeRequest, KnowledgeScope } from '@/lib/types';

// List knowledge entries with optional scope filtering
export function listKnowledge(options?: {
  scope?: KnowledgeScope;
  scope_id?: string;
  entry_type?: string;
  search?: string;
  tags?: string[];
}): KnowledgeEntry[] {
  let sql = 'SELECT * FROM knowledge_entries WHERE 1=1';
  const params: string[] = [];

  if (options?.scope) {
    sql += ' AND kb_scope = ?';
    params.push(options.scope);
  }

  if (options?.scope_id) {
    sql += ' AND scope_id = ?';
    params.push(options.scope_id);
  }

  if (options?.entry_type) {
    sql += ' AND entry_type = ?';
    params.push(options.entry_type);
  }

  if (options?.search) {
    sql += ' AND (title LIKE ? OR content LIKE ?)';
    const s = `%${options.search}%`;
    params.push(s, s);
  }

  if (options?.tags && options.tags.length > 0) {
    // Match any of the tags
    const tagConditions = options.tags.map(() => 'tags LIKE ?').join(' OR ');
    sql += ` AND (${tagConditions})`;
    options.tags.forEach(tag => params.push(`%${tag}%`));
  }

  sql += ' ORDER BY created_at DESC';

  return queryAll<KnowledgeEntry>(sql, params);
}

// Get knowledge entry by ID
export function getKnowledge(id: string): KnowledgeEntry | undefined {
  return queryOne<KnowledgeEntry>('SELECT * FROM knowledge_entries WHERE id = ?', [id]);
}

// Create knowledge entry
export function createKnowledge(data: CreateKnowledgeRequest): KnowledgeEntry {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO knowledge_entries (id, title, content, kb_scope, scope_id, entry_type, tags, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.title,
      data.content,
      data.scope,
      data.scope_id || null,
      data.entry_type || 'document',
      data.tags || null,
      null, // created_by - will be set by caller
      now,
      now,
    ]
  );

  return getKnowledge(id)!;
}

// Update knowledge entry
export function updateKnowledge(id: string, data: Partial<CreateKnowledgeRequest>): KnowledgeEntry | undefined {
  const existing = getKnowledge(id);
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
  if (data.scope !== undefined) {
    updates.push('kb_scope = ?');
    params.push(data.scope);
  }
  if (data.scope_id !== undefined) {
    updates.push('scope_id = ?');
    params.push(data.scope_id);
  }
  if (data.entry_type !== undefined) {
    updates.push('entry_type = ?');
    params.push(data.entry_type);
  }
  if (data.tags !== undefined) {
    updates.push('tags = ?');
    params.push(data.tags);
  }

  updates.push('updated_at = ?');
  params.push(now);
  params.push(id);

  run(`UPDATE knowledge_entries SET ${updates.join(', ')} WHERE id = ?`, params);
  return getKnowledge(id);
}

// Delete knowledge entry
export function deleteKnowledge(id: string): boolean {
  const existing = getKnowledge(id);
  if (!existing) return false;
  run('DELETE FROM knowledge_entries WHERE id = ?', [id]);
  return true;
}

// Get knowledge for a specific context (builds hierarchical context)
export function getKnowledgeForContext(options: {
  client_id?: string;
  project_id?: string;
  task_id?: string;
  limit?: number;
}): KnowledgeEntry[] {
  const results: KnowledgeEntry[] = [];
  const seen = new Set<string>();
  const limit = options.limit || 50;

  // 1. Global knowledge (always included)
  const global = listKnowledge({ scope: 'global' });
  for (const entry of global) {
    if (!seen.has(entry.id) && results.length < limit) {
      results.push(entry);
      seen.add(entry.id);
    }
  }

  // 2. Client knowledge
  if (options.client_id) {
    const client = listKnowledge({ scope: 'client', scope_id: options.client_id });
    for (const entry of client) {
      if (!seen.has(entry.id) && results.length < limit) {
        results.push(entry);
        seen.add(entry.id);
      }
    }
  }

  // 3. Project knowledge
  if (options.project_id) {
    const project = listKnowledge({ scope: 'project', scope_id: options.project_id });
    for (const entry of project) {
      if (!seen.has(entry.id) && results.length < limit) {
        results.push(entry);
        seen.add(entry.id);
      }
    }

    // Also include project-linked knowledge
    const linked = queryAll<KnowledgeEntry>(
      `SELECT ke.* FROM knowledge_entries ke
       INNER JOIN project_knowledge pk ON ke.id = pk.knowledge_entry_id
       WHERE pk.project_id = ?`,
      [options.project_id]
    );
    for (const entry of linked) {
      if (!seen.has(entry.id) && results.length < limit) {
        results.push(entry);
        seen.add(entry.id);
      }
    }
  }

  // 4. Task-specific knowledge
  if (options.task_id) {
    const task = listKnowledge({ scope: 'task', scope_id: options.task_id });
    for (const entry of task) {
      if (!seen.has(entry.id) && results.length < limit) {
        results.push(entry);
        seen.add(entry.id);
      }
    }
  }

  return results;
}

// Add knowledge to project
export function addKnowledgeToProject(projectId: string, knowledgeId: string, addedBy?: string): boolean {
  try {
    run(
      `INSERT OR IGNORE INTO project_knowledge (project_id, knowledge_entry_id, added_by, added_at)
       VALUES (?, ?, ?, ?)`,
      [projectId, knowledgeId, addedBy || null, new Date().toISOString()]
    );
    return true;
  } catch {
    return false;
  }
}

export function removeKnowledgeFromProject(projectId: string, knowledgeId: string): boolean {
  const result = run(
    'DELETE FROM project_knowledge WHERE project_id = ? AND knowledge_entry_id = ?',
    [projectId, knowledgeId]
  );
  return result.changes > 0;
}

// Get project linked knowledge
export function getProjectKnowledge(projectId: string): KnowledgeEntry[] {
  return queryAll<KnowledgeEntry>(
    `SELECT ke.* FROM knowledge_entries ke
     INNER JOIN project_knowledge pk ON ke.id = pk.knowledge_entry_id
     WHERE pk.project_id = ?
     ORDER BY pk.relevance_score DESC`,
    [projectId]
  );
}

// Search knowledge with semantic ranking (basic implementation)
export function searchKnowledge(query: string, options?: {
  client_id?: string;
  project_id?: string;
  limit?: number;
}): KnowledgeEntry[] {
  const limit = options?.limit || 20;
  const results: KnowledgeEntry[] = [];
  const seen = new Set<string>();

  // Build context-appropriate query
  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);

  // Priority 1: Global (matched against search)
  const global = listKnowledge({ scope: 'global' });
  for (const entry of global) {
    const score = calculateRelevanceScore(entry, searchTerms);
    if (score > 0) {
      results.push({ ...entry, metadata: JSON.stringify({ score }) } as KnowledgeEntry);
      seen.add(entry.id);
    }
  }

  // Priority 2: Client knowledge
  if (options?.client_id) {
    const client = listKnowledge({ scope: 'client', scope_id: options.client_id });
    for (const entry of client) {
      if (!seen.has(entry.id)) {
        const score = calculateRelevanceScore(entry, searchTerms);
        if (score > 0) {
          results.push({ ...entry, metadata: JSON.stringify({ score }) } as KnowledgeEntry);
          seen.add(entry.id);
        }
      }
    }
  }

  // Priority 3: Project knowledge
  if (options?.project_id) {
    const project = listKnowledge({ scope: 'project', scope_id: options.project_id });
    for (const entry of project) {
      if (!seen.has(entry.id)) {
        const score = calculateRelevanceScore(entry, searchTerms);
        if (score > 0) {
          results.push({ ...entry, metadata: JSON.stringify({ score }) } as KnowledgeEntry);
          seen.add(entry.id);
        }
      }
    }
  }

  // Sort by score and limit
  return results
    .sort((a, b) => {
      const scoreA = JSON.parse(a.metadata || '{}').score || 0;
      const scoreB = JSON.parse(b.metadata || '{}').score || 0;
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

function calculateRelevanceScore(entry: KnowledgeEntry, searchTerms: string[]): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const contentLower = entry.content.toLowerCase();
  const tagsLower = (entry.tags || '').toLowerCase();

  for (const term of searchTerms) {
    // Title matches are most important
    if (titleLower.includes(term)) score += 10;
    // Content matches
    if (contentLower.includes(term)) score += 5;
    // Tag matches
    if (tagsLower.includes(term)) score += 3;
  }

  return score;
}

/**
 * Build hierarchical context text for agents
 * Returns formatted context string with: global -> client -> project -> task knowledge
 */
export function buildAgentContext(options: {
  client_id?: string;
  project_id?: string;
  task_id?: string;
  include_files?: boolean;
  limit?: number;
}): string {
  const parts: string[] = [];
  const limit = options.limit || 50;

  // 1. Global knowledge header
  const global = listKnowledge({ scope: 'global' });
  if (global.length > 0) {
    parts.push('## GLOBAL KNOWLEDGE (Legal Framework & Templates)');
    for (const entry of global.slice(0, 10)) {
      parts.push(`\n### ${entry.title} [${entry.entry_type}]`);
      parts.push(entry.content.slice(0, 500));
      if (entry.tags) parts.push(`Tags: ${entry.tags}`);
    }
  }

  // 2. Client knowledge
  if (options.client_id) {
    const client = listKnowledge({ scope: 'client', scope_id: options.client_id });
    if (client.length > 0) {
      parts.push('\n\n## CLIENT-SPECIFIC KNOWLEDGE');
      for (const entry of client.slice(0, 10)) {
        parts.push(`\n### ${entry.title} [${entry.entry_type}]`);
        parts.push(entry.content.slice(0, 500));
        if (entry.tags) parts.push(`Tags: ${entry.tags}`);
      }
    }
  }

  // 3. Project knowledge
  if (options.project_id) {
    const project = listKnowledge({ scope: 'project', scope_id: options.project_id });
    if (project.length > 0) {
      parts.push('\n\n## PROJECT-SPECIFIC KNOWLEDGE');
      for (const entry of project.slice(0, 10)) {
        parts.push(`\n### ${entry.title} [${entry.entry_type}]`);
        parts.push(entry.content.slice(0, 500));
        if (entry.tags) parts.push(`Tags: ${entry.tags}`);
      }
    }

    // Also get linked knowledge
    const linked = getProjectKnowledge(options.project_id);
    if (linked.length > 0) {
      parts.push('\n\n## RELATED PROJECT KNOWLEDGE');
      for (const entry of linked.slice(0, 5)) {
        parts.push(`\n### ${entry.title}`);
        parts.push(entry.content.slice(0, 300));
      }
    }
  }

  // 4. Task-specific knowledge
  if (options.task_id) {
    const task = listKnowledge({ scope: 'task', scope_id: options.task_id });
    if (task.length > 0) {
      parts.push('\n\n## CASE-SPECIFIC KNOWLEDGE');
      for (const entry of task.slice(0, 10)) {
        parts.push(`\n### ${entry.title} [${entry.entry_type}]`);
        parts.push(entry.content);
        if (entry.tags) parts.push(`Tags: ${entry.tags}`);
      }
    }
  }

  return parts.join('\n').slice(0, 8000);
}
