import { v4 as uuidv4 } from 'uuid';
import { queryAll, queryOne, run } from './index';
import type { CaseMessage, CreateCaseMessageRequest, SenderType } from '@/lib/types';

// List messages for a case (task)
export function listCaseMessages(taskId: string, options?: {
  limit?: number;
  before?: string;
}): CaseMessage[] {
  let sql = 'SELECT * FROM case_messages WHERE task_id = ?';
  const params: string[] = [taskId];

  if (options?.before) {
    sql += ' AND created_at < ?';
    params.push(options.before);
  }

  sql += ' ORDER BY created_at DESC';

  if (options?.limit) {
    sql += ` LIMIT ${options.limit}`;
  }

  return queryAll<CaseMessage>(sql, params);
}

// Get message by ID
export function getCaseMessage(id: string): CaseMessage | undefined {
  return queryOne<CaseMessage>('SELECT * FROM case_messages WHERE id = ?', [id]);
}

// Create a new message
export function createCaseMessage(taskId: string, data: CreateCaseMessageRequest): CaseMessage {
  const id = uuidv4();
  const now = new Date().toISOString();

  run(
    `INSERT INTO case_messages (id, task_id, sender_type, sender_id, sender_name, content, message_format, metadata, is_ai_response, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      taskId,
      data.sender_type,
      data.sender_id,
      data.sender_name,
      data.content,
      data.message_format || 'text',
      null, // metadata
      data.is_ai_response ? 1 : 0,
      now,
    ]
  );

  return getCaseMessage(id)!;
}

// Delete message (only non-system, non-ai messages can be deleted)
export function deleteCaseMessage(id: string): boolean {
  const message = getCaseMessage(id);
  if (!message) return false;
  if (message.sender_type === 'system') return false;
  if (message.is_ai_response) return false;

  run('DELETE FROM case_messages WHERE id = ?', [id]);
  return true;
}

// Get recent messages for a task (for context building)
export function getRecentMessages(taskId: string, limit: number = 50): CaseMessage[] {
  return queryAll<CaseMessage>(
    'SELECT * FROM case_messages WHERE task_id = ? ORDER BY created_at DESC LIMIT ?',
    [taskId, limit]
  );
}

// Format messages for display (converts raw data to readable format)
export function formatMessagesForDisplay(messages: CaseMessage[]): CaseMessage[] {
  return messages.sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

// Add system message (automatically created for important events)
export function addSystemMessage(taskId: string, description: string, metadata?: object): CaseMessage {
  return createCaseMessage(taskId, {
    sender_type: 'system',
    sender_id: 'system',
    sender_name: 'System',
    content: description,
    is_ai_response: false,
  });
}

// Add agent response
export function addAgentMessage(taskId: string, agentId: string, agentName: string, content: string): CaseMessage {
  return createCaseMessage(taskId, {
    sender_type: 'agent',
    sender_id: agentId,
    sender_name: agentName,
    content,
    is_ai_response: true,
  });
}

// Add user message
export function addUserMessage(taskId: string, userId: string, userName: string, content: string): CaseMessage {
  return createCaseMessage(taskId, {
    sender_type: 'user',
    sender_id: userId,
    sender_name: userName,
    content,
    is_ai_response: false,
  });
}

// Get message count for a task
export function getMessageCount(taskId: string): number {
  const result = queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM case_messages WHERE task_id = ?',
    [taskId]
  );
  return result?.count || 0;
}

// Get latest message
export function getLatestMessage(taskId: string): CaseMessage | undefined {
  return queryOne<CaseMessage>(
    'SELECT * FROM case_messages WHERE task_id = ? ORDER BY created_at DESC LIMIT 1',
    [taskId]
  );
}
