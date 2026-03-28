// Core types for Mission Control

export type AgentStatus = 'standby' | 'working' | 'offline';

export type TaskStatus = 'not_started' | 'in_progress' | 'done' | 'blocked' | 'awaiting_approval';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type MessageType = 'text' | 'system' | 'task_update' | 'file';

export type ConversationType = 'direct' | 'group' | 'task';

export type EventType =
  | 'task_created'
  | 'task_assigned'
  | 'task_status_changed'
  | 'task_completed'
  | 'task_dispatched'
  | 'dispatch_failed'
  | 'message_sent'
  | 'agent_status_changed'
  | 'agent_joined'
  | 'system';

export interface Agent {
  id: string;
  name: string;
  role: string;
  description?: string;
  avatar_emoji: string;
  status: AgentStatus;
  is_master: boolean;
  workspace_id: string;
  soul_md?: string;
  user_md?: string;
  agents_md?: string;
  heartbeat_md?: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_agent_id?: string;
  created_by_agent_id?: string;
  workspace_id: string;
  business_id: string;
  due_date?: string;
  notion_page_id?: string;
  notion_last_synced?: string;
  planning_session_key?: string;
  planning_complete?: boolean;
  client_id?: string;
  project_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assigned_agent?: Agent;
  created_by_agent?: Agent;
  client?: Client;
  project?: Project;
}

export interface Conversation {
  id: string;
  title?: string;
  type: ConversationType;
  task_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  participants?: Agent[];
  last_message?: Message;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_agent_id?: string;
  content: string;
  message_type: MessageType;
  metadata?: string;
  created_at: string;
  // Joined fields
  sender?: Agent;
}

export interface Event {
  id: string;
  type: EventType;
  agent_id?: string;
  task_id?: string;
  message: string;
  metadata?: string;
  created_at: string;
  // Joined fields
  agent?: Agent;
  task?: Task;
}

export interface Business {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceStats {
  id: string;
  name: string;
  slug: string;
  icon: string;
  taskCounts: {
    not_started: number;
    in_progress: number;
    done: number;
    blocked: number;
    awaiting_approval: number;
    total: number;
  };
  agentCount: number;
}

export interface OpenClawSession {
  id: string;
  agent_id: string;
  openclaw_session_id: string;
  channel?: string;
  status: string;
  session_type: 'persistent' | 'subagent';
  task_id?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType = 'spawned' | 'updated' | 'completed' | 'file_created' | 'status_changed';

export interface TaskActivity {
  id: string;
  task_id: string;
  agent_id?: string;
  activity_type: ActivityType;
  message: string;
  metadata?: string;
  created_at: string;
  // Joined fields
  agent?: Agent;
}

export type DeliverableType = 'file' | 'url' | 'artifact';

export interface TaskDeliverable {
  id: string;
  task_id: string;
  deliverable_type: DeliverableType;
  title: string;
  path?: string;
  description?: string;
  created_at: string;
}

// Planning types
export type PlanningQuestionType = 'multiple_choice' | 'text' | 'yes_no';

export type PlanningCategory = 
  | 'goal'
  | 'audience'
  | 'scope'
  | 'design'
  | 'content'
  | 'technical'
  | 'timeline'
  | 'constraints';

export interface PlanningQuestionOption {
  id: string;
  label: string;
}

export interface PlanningQuestion {
  id: string;
  task_id: string;
  category: PlanningCategory;
  question: string;
  question_type: PlanningQuestionType;
  options?: PlanningQuestionOption[];
  answer?: string;
  answered_at?: string;
  sort_order: number;
  created_at: string;
}

export interface PlanningSpec {
  id: string;
  task_id: string;
  spec_markdown: string;
  locked_at: string;
  locked_by?: string;
  created_at: string;
}

export interface PlanningState {
  questions: PlanningQuestion[];
  spec?: PlanningSpec;
  progress: {
    total: number;
    answered: number;
    percentage: number;
  };
  isLocked: boolean;
}

// Client and Project types
export type ProjectStatus = 'active' | 'on_hold' | 'archived';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  telegram_id?: string;
  telegram_username?: string;
  contact_info?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  client_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
}

export interface CreateClientRequest {
  name: string;
  email?: string;
  phone?: string;
  telegram_id?: string;
  telegram_username?: string;
  contact_info?: string;
  notes?: string;
}

export interface UpdateClientRequest extends Partial<CreateClientRequest> {}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  status?: ProjectStatus;
  client_id?: string;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {}

// API request/response types
export interface CreateAgentRequest {
  name: string;
  role: string;
  description?: string;
  avatar_emoji?: string;
  is_master?: boolean;
  soul_md?: string;
  user_md?: string;
  agents_md?: string;
  heartbeat_md?: string;
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {
  status?: AgentStatus;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  assigned_agent_id?: string;
  created_by_agent_id?: string;
  business_id?: string;
  due_date?: string;
  client_id?: string;
  project_id?: string;
}

export interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  status?: TaskStatus;
}

export interface SendMessageRequest {
  conversation_id: string;
  sender_agent_id: string;
  content: string;
  message_type?: MessageType;
  metadata?: string;
}

// OpenClaw WebSocket message types
export interface OpenClawMessage {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface OpenClawSessionInfo {
  id: string;
  channel: string;
  peer?: string;
  model?: string;
  status: string;
}

// OpenClaw history message format (from Gateway)
export interface OpenClawHistoryMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Agent with OpenClaw session info (extended for UI use)
export interface AgentWithOpenClaw extends Agent {
  openclawSession?: OpenClawSession | null;
}

// Real-time SSE event types
export type SSEEventType =
  | 'task_updated'
  | 'task_created'
  | 'task_deleted'
  | 'event_added'
  | 'activity_logged'
  | 'deliverable_added'
  | 'agent_spawned'
  | 'agent_completed';

export interface SSEEvent {
  type: SSEEventType;
  payload: Task | TaskActivity | TaskDeliverable | {
    taskId: string;
    sessionId: string;
    agentName?: string;
    summary?: string;
    deleted?: boolean;
  } | {
    id: string;  // For task_deleted events
  } | {
    id: string;
    type: string;
    task_id?: string;
    message: string;
    created_at: string;
  };  // For event_added
}

export type AttachmentType = 'file' | 'link' | 'note';

export interface TaskAttachment {
  id: string;
  task_id: string;
  attachment_type: AttachmentType;
  title: string;
  url?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  content?: string;
  description?: string;
  uploaded_by: string;
  created_at: string;
  scope?: 'task' | 'client' | 'project' | 'global';
  scope_id?: string;
  agent_id?: string;
  is_deletable?: boolean;
}

// ============================================
// USERS & RBAC
// ============================================

export type UserRole = 'admin' | 'worker' | 'client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface UpdateUserRequest extends Partial<CreateUserRequest> {
  is_active?: boolean;
}

export interface UserClientAccess {
  user_id: string;
  client_id: string;
  granted_by?: string;
  granted_at: string;
}

export interface UserProjectAccess {
  user_id: string;
  project_id: string;
  granted_by?: string;
  granted_at: string;
}

// ============================================
// KNOWLEDGE HIERARCHY
// ============================================

export type KnowledgeScope = 'global' | 'client' | 'project' | 'task';
export type KnowledgeEntryType = 'document' | 'template' | 'precedent' | 'law' | 'memo' | 'note';

export interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  kb_scope: KnowledgeScope;
  scope_id?: string;
  entry_type: KnowledgeEntryType;
  tags?: string;
  metadata?: string;
  embedding_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateKnowledgeRequest {
  title: string;
  content: string;
  scope: KnowledgeScope;
  scope_id?: string;
  entry_type?: KnowledgeEntryType;
  tags?: string;
}

export interface ProjectKnowledge {
  project_id: string;
  knowledge_entry_id: string;
  relevance_score: number;
  added_by?: string;
  added_at: string;
}

// ============================================
// CASE CHAT
// ============================================

export type SenderType = 'agent' | 'user' | 'system';
export type MessageFormat = 'text' | 'markdown' | 'html';

export interface CaseMessage {
  id: string;
  task_id: string;
  sender_type: SenderType;
  sender_id: string;
  sender_name: string;
  content: string;
  message_format: MessageFormat;
  metadata?: string;
  is_ai_response: boolean;
  created_at: string;
}

export interface CreateCaseMessageRequest {
  content: string;
  sender_type: SenderType;
  sender_id: string;
  sender_name: string;
  message_format?: MessageFormat;
  is_ai_response?: boolean;
}

// ============================================
// CASE TIMELINE
// ============================================

export type TimelineEventType = 
  | 'created' 
  | 'assigned' 
  | 'status_changed' 
  | 'priority_changed'
  | 'client_linked' 
  | 'project_linked' 
  | 'document_added' 
  | 'comment_added'
  | 'escalated' 
  | 'deescalated' 
  | 'blocked' 
  | 'unblocked' 
  | 'completed'
  | 'agent_responded' 
  | 'client_responded' 
  | 'deadline_set' 
  | 'deadline_changed';

export interface CaseTimeline {
  id: string;
  task_id: string;
  event_type: TimelineEventType;
  actor_type?: 'agent' | 'user' | 'system';
  actor_id?: string;
  actor_name?: string;
  description: string;
  metadata?: string | object;
  created_at: string;
}

export interface CreateTimelineEventRequest {
  event_type: TimelineEventType;
  actor_type?: 'agent' | 'user' | 'system';
  actor_id?: string;
  actor_name?: string;
  description: string;
  metadata?: string | object;
}

// ============================================
// AGENT MEMORY
// ============================================

export type MemoryType = 'file' | 'lesson' | 'precedent' | 'template' | 'note';

export interface AgentMemory {
  id: string;
  agent_id: string;
  memory_type: MemoryType;
  title: string;
  content?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  url?: string;
  tags?: string;
  metadata?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateAgentMemoryRequest {
  memory_type: MemoryType;
  title: string;
  content?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  url?: string;
  tags?: string;
}

// ============================================
// CASE LINKS
// ============================================

export type LinkType = 'url' | 'document' | 'notion' | 'email' | 'other';

export interface CaseLink {
  id: string;
  task_id: string;
  link_type: LinkType;
  title: string;
  url: string;
  description?: string;
  created_by?: string;
  created_at: string;
}

export interface CreateCaseLinkRequest {
  link_type: LinkType;
  title: string;
  url: string;
  description?: string;
}

// ============================================
// ENHANCED DELIVERABLES
// ============================================

export interface Deliverable {
  id: string;
  task_id: string;
  deliverable_type: string;
  title: string;
  path?: string;
  description?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  file_mime?: string;
  url?: string;
  agent_id?: string;
  created_at: string;
}

// ============================================
// CLIENT-PROJECT JUNCTION
// ============================================

export interface ClientProject {
  client_id: string;
  project_id: string;
  role: 'owner' | 'member' | 'viewer';
  created_at: string;
}

export interface ClientWithDetails extends Client {
  projects?: Project[];
  user_account?: User;
  tasks?: Task[];
}

export interface ClientWithStats extends Client {
  project_count?: number;
  task_count?: number;
  active_task_count?: number;
}

export interface ProjectWithClients extends Project {
  clients?: Client[];
}

export interface ProjectWithClientName extends Project {
  client_name?: string;
  client_email?: string;
  task_count?: number;
  active_task_count?: number;
}

// ============================================
// CONTEXT BUILDING (for AI agents)
// ============================================

export interface AgentContext {
  global_knowledge: KnowledgeEntry[];
  client_knowledge: KnowledgeEntry[];
  project_knowledge: KnowledgeEntry[];
  task_knowledge: KnowledgeEntry[];
  task: Task;
  client?: Client;
  project?: Project;
  recent_messages: CaseMessage[];
  timeline: CaseTimeline[];
}
