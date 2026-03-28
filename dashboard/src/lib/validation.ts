/**
 * Zod validation schemas for all API request types.
 *
 * Usage in route handlers:
 *
 *   import { parseRequest, schemas } from '@/lib/validation';
 *
 *   export async function POST(request: NextRequest) {
 *     const body = await parseRequest(request, schemas.createTask);
 *     // body is fully typed as CreateTaskInput
 *     const task = createTask(body);
 *     return NextResponse.json(task, { status: 201 });
 *   }
 *
 * Validation errors throw ValidationError (400) with Zod's field-level
 * error map in the `details` field.
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { ValidationError } from './errors';

// ── Enums as Zod schemas ────────────────────────────────────────────────────────

export const agentStatusSchema = z.enum(['standby', 'busy', 'offline']);

export const taskStatusSchema = z.enum([
  'not_started',
  'in_progress',
  'intake',
  'research',
  'drafting',
  'review',
  'testing',
  'client_input',
  'awaiting_approval',
  'done',
  'cancelled',
  'blocked',
  'planning',
]);

export const taskPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent']);

export const projectStatusSchema = z.enum(['active', 'on_hold', 'archived']);

export const attachmentTypeSchema = z.enum(['file', 'link', 'note']);

export const deliverableTypeSchema = z.enum(['file', 'url', 'artifact']);

export const knowledgeScopeSchema = z.enum(['global', 'client', 'project', 'task']);

export const entryTypeSchema = z.enum(['document', 'template', 'precedent', 'law', 'memo', 'note']);

export const memoryTypeSchema = z.enum(['file', 'lesson', 'precedent', 'template', 'note']);

export const linkTypeSchema = z.enum(['url', 'document', 'notion', 'email', 'other']);

export const senderTypeSchema = z.enum(['agent', 'user', 'system']);

export const messageFormatSchema = z.enum(['text', 'markdown', 'html']);

export const userRoleSchema = z.enum(['admin', 'mod', 'company', 'client']);

export const sessionTypeSchema = z.enum(['persistent', 'subagent', 'planning']);

export const conversationTypeSchema = z.enum(['direct', 'group', 'task']);

export const messageTypeSchema = z.enum(['text', 'system', 'task_update', 'file']);

export const timelineEventTypeSchema = z.enum([
  'created',
  'assigned',
  'status_changed',
  'priority_changed',
  'client_linked',
  'project_linked',
  'document_added',
  'comment_added',
  'escalated',
  'deescalated',
  'blocked',
  'unblocked',
  'completed',
  'agent_responded',
  'client_responded',
  'deadline_set',
  'deadline_changed',
]);

// ── Reusable primitives ──────────────────────────────────────────────────────────

const uuidSchema = z.string().uuid({ message: 'Invalid UUID format' });
const optionalUuidSchema = uuidSchema.optional();
const nonEmptyString = (min = 1, max = 10_000) =>
  z.string().min(min, { message: `String must be at least ${min} character(s)` }).max(max);

// ── Task schemas ─────────────────────────────────────────────────────────────────

export const createTaskSchema = z.object({
  title: nonEmptyString(1, 500),
  description: z.string().max(50_000).optional(),
  status: taskStatusSchema.optional().default('not_started'),
  priority: taskPrioritySchema.optional().default('normal'),
  assigned_agent_id: optionalUuidSchema,
  created_by_agent_id: optionalUuidSchema,
  business_id: z.string().max(100).optional(),
  due_date: z.string().datetime().optional().or(z.string().max(0)).optional(), // ISO datetime or empty
  client_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  notion_page_id: z.string().max(500).optional(),
});

export const updateTaskSchema = z.object({
  title: nonEmptyString(1, 500).optional(),
  description: z.string().max(50_000).optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigned_agent_id: optionalUuidSchema,
  created_by_agent_id: optionalUuidSchema,
  /** Agent making the request — used for workflow approval gate checks */
  updated_by_agent_id: optionalUuidSchema,
  business_id: z.string().max(100).optional(),
  due_date: z.string().datetime().optional().or(z.string().max(0)).optional(),
  client_id: optionalUuidSchema,
  project_id: optionalUuidSchema,
  notion_page_id: z.string().max(500).optional(),
  sub_status: z.string().max(200).optional(),
});

export const patchTaskStatusSchema = z.object({
  status: taskStatusSchema,
  updated_by_agent_id: optionalUuidSchema,
});

// ── Client schemas ───────────────────────────────────────────────────────────────

export const createClientSchema = z.object({
  name: nonEmptyString(1, 300),
  email: z.string().email().max(500).optional().or(z.string().max(0)).optional(),
  phone: z.string().max(50).optional(),
  telegram_id: z.string().max(100).optional(),
  telegram_username: z.string().max(100).optional(),
  contact_info: z.string().max(2000).optional(),
  notes: z.string().max(10_000).optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ── Project schemas ──────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: nonEmptyString(1, 300),
  description: z.string().max(10_000).optional(),
  status: projectStatusSchema.optional().default('active'),
  client_id: optionalUuidSchema,
  project_type: z.string().max(100).optional(),
  tags: z.string().max(1000).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

// ── Agent schemas ────────────────────────────────────────────────────────────────

export const createAgentSchema = z.object({
  name: nonEmptyString(1, 200),
  role: nonEmptyString(1, 200),
  description: z.string().max(5000).optional(),
  avatar_emoji: z.string().max(10).optional(),
  is_master: z.boolean().optional().default(false),
  soul_md: z.string().max(100_000).optional(),
  user_md: z.string().max(100_000).optional(),
  agents_md: z.string().max(100_000).optional(),
  heartbeat_md: z.string().max(100_000).optional(),
  workspace_id: z.string().max(100).optional(),
});

export const updateAgentSchema = z.object({
  name: nonEmptyString(1, 200).optional(),
  role: nonEmptyString(1, 200).optional(),
  description: z.string().max(5000).optional(),
  avatar_emoji: z.string().max(10).optional(),
  status: agentStatusSchema.optional(),
  is_master: z.boolean().optional(),
  soul_md: z.string().max(100_000).optional(),
  user_md: z.string().max(100_000).optional(),
  agents_md: z.string().max(100_000).optional(),
  heartbeat_md: z.string().max(100_000).optional(),
  workspace_id: z.string().max(100).optional(),
});

// ── Knowledge schemas ────────────────────────────────────────────────────────────

export const createKnowledgeSchema = z.object({
  title:   nonEmptyString(1, 500),
  content: z.string().max(500_000).optional().default(''),
  scope:   knowledgeScopeSchema,
  scope_id: optionalUuidSchema,
  entry_type: entryTypeSchema.optional().default('document'),
  tags:    z.string().max(2000).optional(),
});

export const updateKnowledgeSchema = z.object({
  title: nonEmptyString(1, 500).optional(),
  content: z.string().max(500_000).optional(),
  entry_type: entryTypeSchema.optional(),
  tags: z.string().max(2000).optional(),
});

// ── Case message schemas ────────────────────────────────────────────────────────

export const createCaseMessageSchema = z.object({
  task_id: uuidSchema,
  content: nonEmptyString(1, 100_000),
  sender_type: senderTypeSchema,
  sender_id: uuidSchema,
  sender_name: nonEmptyString(1, 200),
  message_format: messageFormatSchema.optional().default('text'),
  metadata: z.string().max(10_000).optional(),
  is_ai_response: z.boolean().optional().default(false),
});

export const createTimelineEventSchema = z.object({
  task_id: uuidSchema,
  event_type: timelineEventTypeSchema,
  actor_type: senderTypeSchema.optional(),
  actor_id: optionalUuidSchema,
  actor_name: z.string().max(200).optional(),
  description: nonEmptyString(1, 2000),
  metadata: z.string().max(10_000).optional(),
});

// ── User schemas ────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }),
  password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
  name: nonEmptyString(1, 200),
  role: userRoleSchema,
});

export const updateUserSchema = z.object({
  email: z.string().email({ message: 'Invalid email address' }).optional(),
  password: z.string().min(8).optional(),
  name: nonEmptyString(1, 200).optional(),
  role: userRoleSchema.optional(),
  is_active: z.boolean().optional(),
});

// ── Communication schemas ──────────────────────────────────────────────────────

export const createCommunicationSchema = z.object({
  task_id:   optionalUuidSchema,
  channel:   z.enum(['email', 'telegram']),
  direction: z.enum(['inbound', 'outbound']),
  sender:    z.string().max(200).optional(),
  recipient: z.string().max(200).optional(),
  subject:   z.string().max(500).optional(),
  body:      nonEmptyString(1, 50_000),
});

// ── Agent memory schemas ────────────────────────────────────────────────────────

export const createAgentMemorySchema = z.object({
  memory_type: memoryTypeSchema,
  title: nonEmptyString(1, 500),
  content: z.string().max(500_000).optional(),
  file_path: z.string().max(1000).optional(),
  file_name: z.string().max(500).optional(),
  file_size: z.number().int().nonnegative().optional(),
  file_mime: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  tags: z.string().max(2000).optional(),
});

// ── Case link schemas ───────────────────────────────────────────────────────────

export const createCaseLinkSchema = z.object({
  task_id: uuidSchema,
  link_type: linkTypeSchema,
  title: nonEmptyString(1, 500),
  url: z.string().url({ message: 'Invalid URL format' }).max(2000),
  description: z.string().max(5000).optional(),
});

// ── Planning schemas ────────────────────────────────────────────────────────────

export const createPlanningAnswerSchema = z.object({
  question_id: uuidSchema,
  answer: z.string().max(50_000).optional(),
});

export const lockPlanningSpecSchema = z.object({
  spec_markdown: nonEmptyString(1, 500_000),
});

// ── Deliverable schemas ────────────────────────────────────────────────────────

export const createDeliverableSchema = z.object({
  task_id: uuidSchema,
  deliverable_type: deliverableTypeSchema,
  title: nonEmptyString(1, 500),
  path: z.string().max(1000).optional(),
  file_path: z.string().max(1000).optional(),
  file_name: z.string().max(500).optional(),
  file_size: z.number().int().nonnegative().optional(),
  file_mime: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  description: z.string().max(10_000).optional(),
  agent_id: optionalUuidSchema,
});

// ── Attachment schemas ──────────────────────────────────────────────────────────

export const createTaskAttachmentSchema = z.object({
  task_id: uuidSchema,
  attachment_type: attachmentTypeSchema,
  title: nonEmptyString(1, 500),
  url: z.string().max(2000).optional(),
  file_path: z.string().max(1000).optional(),
  file_name: z.string().max(500).optional(),
  file_size: z.number().int().nonnegative().optional(),
  file_mime: z.string().max(200).optional(),
  content: z.string().max(1_000_000).optional(),
  description: z.string().max(10_000).optional(),
  uploaded_by: z.string().max(100).optional().default('user'),
  kb_scope: knowledgeScopeSchema.optional().default('task'),
  scope_id: optionalUuidSchema,
  agent_id: optionalUuidSchema,
  is_deletable: z.boolean().optional().default(true),
});

// ── OpenClaw schemas ────────────────────────────────────────────────────────────

export const createOpenClawSessionSchema = z.object({
  channel: z.enum(['terminal', 'chat', 'subagent']).default('chat'),
  peer: z.string().max(200).optional(),
});

export const sendOpenClawMessageSchema = z.object({
  sessionKey: z.string().min(1),
  message:   nonEmptyString(1, 100_000),
});

export const createSessionMessageSchema = z.object({
  content: nonEmptyString(1, 50_000),
  sessionKey: z.string().max(200).optional(),
});

export const updateSessionSchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'error']).optional(),
  ended_at: z.string().datetime().optional(),
});

export const createSubagentSessionSchema = z.object({
  openclaw_session_id: z.string().min(1),
  agent_name: z.string().max(200).optional(),
});

export const sendChatMessageSchema = z.object({
  content: nonEmptyString(1, 100_000),
  session_id: z.string().max(200).optional(),
});

// ── Search query schemas ────────────────────────────────────────────────────────

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  scope: knowledgeScopeSchema.optional(),
  scope_id: optionalUuidSchema,
  tags: z.array(z.string().max(100)).max(20).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

// ── Event schemas ───────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
  type: z.string().min(1).max(100),
  agent_id: optionalUuidSchema,
  task_id: optionalUuidSchema,
  message: nonEmptyString(1, 2000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ── All schemas registry ────────────────────────────────────────────────────────
// Useful for batch validation or documentation

export const schemas = {
  createTask: createTaskSchema,
  updateTask: updateTaskSchema,
  patchTaskStatus: patchTaskStatusSchema,
  createClient: createClientSchema,
  updateClient: updateClientSchema,
  createProject: createProjectSchema,
  updateProject: updateProjectSchema,
  createAgent: createAgentSchema,
  updateAgent: updateAgentSchema,
  createKnowledge: createKnowledgeSchema,
  updateKnowledge: updateKnowledgeSchema,
  createCaseMessage: createCaseMessageSchema,
  createTimelineEvent: createTimelineEventSchema,
  createUser: createUserSchema,
  updateUser: updateUserSchema,
  createAgentMemory: createAgentMemorySchema,
  createCaseLink: createCaseLinkSchema,
  createPlanningAnswer: createPlanningAnswerSchema,
  lockPlanningSpec: lockPlanningSpecSchema,
  createDeliverable: createDeliverableSchema,
  createTaskAttachment: createTaskAttachmentSchema,
  createSubagentSession: createSubagentSessionSchema,
  sendChatMessage: sendChatMessageSchema,
  searchQuery: searchQuerySchema,
  createEvent: createEventSchema,
} as const;

// ── Request parser ─────────────────────────────────────────────────────────────

export type InferredSchemas = typeof schemas;

/**
 * Parses and validates a request body against a Zod schema.
 * Throws ValidationError (400) on failure, with field-level error details.
 *
 * Usage:
 *   const body = await parseRequest(request, schemas.createTask);
 */
export async function parseRequest<S extends z.ZodSchema>(
  request: NextRequest,
  schema: S
): Promise<z.infer<S>> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Request body must be valid JSON');
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    // Format Zod errors into a flat map: { fieldName: ['error message'] }
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
    throw new ValidationError(
      'Request validation failed',
      fieldErrors
    );
  }

  return result.data;
}

/**
 * Parses and validates query parameters against a Zod schema.
 * Useful for GET routes with pagination, filtering, etc.
 */
export function parseQueryParams<T extends z.ZodSchema>(
  url: URL,
  schema: T
): z.infer<T> {
  const params: Record<string, unknown> = {};

  for (const [key, value] of Array.from(url.searchParams.entries())) {
    // Preserve arrays (multiple values for same key)
    if (params[key] !== undefined) {
      if (Array.isArray(params[key])) {
        (params[key] as string[]).push(value);
      } else {
        params[key] = [params[key], value];
      }
    } else {
      params[key] = value;
    }
  }

  const result = schema.safeParse(Object.keys(params).length > 0 ? params : {});

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors as Record<string, string[]>;
    throw new ValidationError('Query parameter validation failed', fieldErrors);
  }

  return result.data;
}
