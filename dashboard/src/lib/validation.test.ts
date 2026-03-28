/**
 * Zod validation schemas — tests.
 *
 * Tests verify the actual schema behavior — not assumed behavior.
 * These schemas are used in production for API input validation,
 * so tests document what the API ACTUALLY accepts/rejects.
 */

import { describe, it, expect } from 'vitest';
import {
  taskStatusSchema,
  taskPrioritySchema,
  agentStatusSchema,
  attachmentTypeSchema,
  deliverableTypeSchema,
  createTaskSchema,
  updateTaskSchema,
  createAgentSchema,
  createKnowledgeSchema,
  createCommunicationSchema,
  createSessionMessageSchema,
} from './validation';

// ── Task status enum ─────────────────────────────────────────────────────────

describe('taskStatusSchema', () => {
  it.each([
    'not_started', 'in_progress', 'intake', 'research',
    'drafting', 'review', 'testing', 'client_input',
    'awaiting_approval', 'done', 'cancelled', 'blocked', 'planning',
  ])('accepts: %s', status => {
    expect(taskStatusSchema.safeParse(status).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(taskStatusSchema.safeParse('COMPLETED').success).toBe(false);
    expect(taskStatusSchema.safeParse('random').success).toBe(false);
    expect(taskStatusSchema.safeParse('').success).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(taskStatusSchema.safeParse('Done').success).toBe(false);
  });
});

// ── Task priority enum ───────────────────────────────────────────────────────

describe('taskPrioritySchema', () => {
  it.each(['low', 'normal', 'high', 'urgent'])('accepts: %s', p => {
    expect(taskPrioritySchema.safeParse(p).success).toBe(true);
  });

  it.each(['lowest', 'critical', 'high-priority', 2])('rejects: %s', p => {
    expect(taskPrioritySchema.safeParse(p).success).toBe(false);
  });
});

// ── Agent status enum ──────────────────────────────────────────────────────

describe('agentStatusSchema', () => {
  it.each(['standby', 'busy', 'offline'])('accepts: %s', s => {
    expect(agentStatusSchema.safeParse(s).success).toBe(true);
  });

  it('rejects unknown statuses', () => {
    expect(agentStatusSchema.safeParse('idle').success).toBe(false);
  });
});

// ── Attachment type enum ───────────────────────────────────────────────────

describe('attachmentTypeSchema', () => {
  it.each(['file', 'link', 'note'])('accepts: %s', t => {
    expect(attachmentTypeSchema.safeParse(t).success).toBe(true);
  });

  it('rejects document, folder', () => {
    expect(attachmentTypeSchema.safeParse('document').success).toBe(false);
    expect(attachmentTypeSchema.safeParse('folder').success).toBe(false);
  });
});

// ── Deliverable type enum ─────────────────────────────────────────────────

describe('deliverableTypeSchema', () => {
  it.each(['file', 'url', 'artifact'])('accepts: %s', t => {
    expect(deliverableTypeSchema.safeParse(t).success).toBe(true);
  });

  it('rejects link, note', () => {
    expect(deliverableTypeSchema.safeParse('link').success).toBe(false);
    expect(deliverableTypeSchema.safeParse('note').success).toBe(false);
  });
});

// ── createTaskSchema ────────────────────────────────────────────────────────

describe('createTaskSchema', () => {
  it('accepts minimal: title only', () => {
    expect(createTaskSchema.safeParse({ title: 'Test task' }).success).toBe(true);
  });

  it('accepts valid UUIDs for agent/client/project fields', () => {
    // These fields use optionalUuidSchema: uuid OR empty string
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    const task = {
      title: 'T',
      assigned_agent_id: validUUID,
      created_by_agent_id: validUUID,
      client_id: validUUID,
      project_id: validUUID,
    };
    expect(createTaskSchema.safeParse(task).success).toBe(true);
  });

  it('rejects missing title', () => {
    expect(createTaskSchema.safeParse({}).success).toBe(false);
  });

  it('rejects empty string title', () => {
    expect(createTaskSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('accepts valid status values', () => {
    expect(createTaskSchema.safeParse({ title: 'T', status: 'done' }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: 'T', status: 'in_progress' }).success).toBe(true);
  });

  it('rejects invalid status', () => {
    expect(createTaskSchema.safeParse({ title: 'T', status: 'COMPLETED' }).success).toBe(false);
    expect(createTaskSchema.safeParse({ title: 'T', status: 'done_not' }).success).toBe(false);
  });

  it('accepts valid priority values', () => {
    expect(createTaskSchema.safeParse({ title: 'T', priority: 'high' }).success).toBe(true);
    expect(createTaskSchema.safeParse({ title: 'T', priority: 'urgent' }).success).toBe(true);
  });

  it('rejects invalid priority', () => {
    expect(createTaskSchema.safeParse({ title: 'T', priority: 'critical' }).success).toBe(false);
  });

  it('accepts ISO datetime for due_date', () => {
    expect(createTaskSchema.safeParse({
      title: 'T',
      due_date: '2026-12-31T23:59:59.000Z',
    }).success).toBe(true);
  });

  it('accepts valid UUID for optional uuid fields', () => {
    const validUUID = '550e8400-e29b-41d4-a716-446655440000';
    const task = {
      title: 'T',
      assigned_agent_id: validUUID,
      client_id: validUUID,
      project_id: validUUID,
    };
    expect(createTaskSchema.safeParse(task).success).toBe(true);
  });

  it('accepts undefined for optional uuid fields (optional())', () => {
    const task = {
      title: 'T',
      assigned_agent_id: undefined,
    };
    expect(createTaskSchema.safeParse(task).success).toBe(true);
  });

  it('rejects non-UUID non-empty string for uuid fields', () => {
    const task = {
      title: 'T',
      assigned_agent_id: 'agent-123',  // not a UUID, not undefined
    };
    expect(createTaskSchema.safeParse(task).success).toBe(false);
  });
});

// ── updateTaskSchema ──────────────────────────────────────────────────────

describe('updateTaskSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update: status only', () => {
    expect(updateTaskSchema.safeParse({ status: 'done' }).success).toBe(true);
  });

  it('accepts partial update: title only', () => {
    expect(updateTaskSchema.safeParse({ title: 'New title' }).success).toBe(true);
  });

  it('accepts partial update: description as string', () => {
    expect(updateTaskSchema.safeParse({ description: 'New desc' }).success).toBe(true);
  });

  it('rejects invalid status in partial update', () => {
    expect(updateTaskSchema.safeParse({ status: 'invalid' }).success).toBe(false);
  });

  it('rejects null description (schema expects undefined for missing, not null)', () => {
    // z.string().optional() means string | undefined, not string | null
    expect(updateTaskSchema.safeParse({ description: null }).success).toBe(false);
  });

  it('accepts valid status transitions', () => {
    expect(updateTaskSchema.safeParse({ status: 'in_progress' }).success).toBe(true);
    expect(updateTaskSchema.safeParse({ status: 'review' }).success).toBe(true);
  });
});

// ── createAgentSchema ────────────────────────────────────────────────────

describe('createAgentSchema', () => {
  it('accepts minimal: name + role', () => {
    expect(createAgentSchema.safeParse({ name: 'Lex COO', role: 'orchestrator' }).success).toBe(true);
  });

  it('accepts full agent with all optional fields', () => {
    const agent = {
      name: 'Lex Intake',
      role: 'intake',
      description: 'Handles incoming tasks',
      avatar_emoji: '📥',
      is_master: false,
      workspace_id: 'default',
      soul_md: '# System prompt',
      user_md: 'User instructions',
    };
    expect(createAgentSchema.safeParse(agent).success).toBe(true);
  });

  it('rejects missing name', () => {
    expect(createAgentSchema.safeParse({ role: 'orchestrator' }).success).toBe(false);
  });

  it('rejects missing role', () => {
    expect(createAgentSchema.safeParse({ name: 'Lex' }).success).toBe(false);
  });

  it('rejects empty string name', () => {
    expect(createAgentSchema.safeParse({ name: '', role: 'x' }).success).toBe(false);
  });

  it('rejects is_master as string "false"', () => {
    // is_master expects boolean, not string
    expect(createAgentSchema.safeParse({ name: 'X', role: 'x', is_master: 'false' }).success).toBe(false);
  });

  it('accepts is_master: false (boolean)', () => {
    expect(createAgentSchema.safeParse({ name: 'X', role: 'x', is_master: false }).success).toBe(true);
  });
});

// ── createKnowledgeSchema ────────────────────────────────────────────────

describe('createKnowledgeSchema', () => {
  it('accepts minimal valid entry (scope is REQUIRED)', () => {
    const result = createKnowledgeSchema.safeParse({
      title: 'Contract precedent',
      scope: 'global',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all valid entry_type values (has default)', () => {
    const types = ['document', 'template', 'precedent', 'law', 'memo', 'note'];
    types.forEach(t => {
      expect(createKnowledgeSchema.safeParse({
        title: 'X', scope: 'global', entry_type: t
      }).success).toBe(true);
    });
  });

  it('accepts all valid scope values', () => {
    const scopes = ['global', 'client', 'project', 'task'];
    scopes.forEach(s => {
      expect(createKnowledgeSchema.safeParse({
        title: 'X', scope: s
      }).success).toBe(true);
    });
  });

  it('rejects missing title', () => {
    expect(createKnowledgeSchema.safeParse({
      scope: 'global'
    }).success).toBe(false);
  });

  it('rejects missing scope', () => {
    // scope is REQUIRED (knowledgeScopeSchema, not optional)
    expect(createKnowledgeSchema.safeParse({
      title: 'X', content: 'x'
    }).success).toBe(false);
  });

  it('rejects invalid scope', () => {
    expect(createKnowledgeSchema.safeParse({
      title: 'X', scope: 'universal'
    }).success).toBe(false);
  });

  it('rejects invalid entry_type', () => {
    expect(createKnowledgeSchema.safeParse({
      title: 'X', scope: 'global', entry_type: 'invalid'
    }).success).toBe(false);
  });
});

// ── createCommunicationSchema ─────────────────────────────────────────────

describe('createCommunicationSchema', () => {
  it('accepts minimal valid communication (body + channel + direction required)', () => {
    const result = createCommunicationSchema.safeParse({
      body: 'Please process this task',
      channel: 'email',
      direction: 'outbound',
    });
    expect(result.success).toBe(true);
  });

  it('accepts with optional fields', () => {
    const result = createCommunicationSchema.safeParse({
      body: 'Hello',
      channel: 'telegram',
      direction: 'inbound',
      recipient: 'bot-1',
      sender: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing body', () => {
    expect(createCommunicationSchema.safeParse({
      channel: 'email', direction: 'outbound'
    }).success).toBe(false);
  });

  it('rejects missing channel', () => {
    expect(createCommunicationSchema.safeParse({
      body: 'Hi', direction: 'outbound'
    }).success).toBe(false);
  });

  it('rejects invalid channel', () => {
    expect(createCommunicationSchema.safeParse({
      body: 'Hi', channel: 'sms', direction: 'outbound'
    }).success).toBe(false);
  });
});

// ── createSessionMessageSchema ────────────────────────────────────────────

describe('createSessionMessageSchema', () => {
  it('accepts minimal message with content', () => {
    expect(createSessionMessageSchema.safeParse({ content: 'Hello' }).success).toBe(true);
  });

  it('accepts with optional metadata', () => {
    const result = createSessionMessageSchema.safeParse({
      content: 'Hello',
      metadata: { intent: 'task_delegate' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty string content', () => {
    expect(createSessionMessageSchema.safeParse({ content: '' }).success).toBe(false);
  });

  it('rejects non-string content', () => {
    expect(createSessionMessageSchema.safeParse({ content: 123 }).success).toBe(false);
  });
});
