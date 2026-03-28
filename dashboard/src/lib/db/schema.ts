/**
 * Database Schema — Mission Control
 *
 * AUTORITYWNE ŹRÓDŁO definicji struktury bazy danych.
 * Wszystkie tabele, kolumny i indeksy muszą być tu udokumentowane.
 *
 * Dla istniejących baz: migracje aplikują zmiany incrementalnie.
 * Dla świeżych baz: ten plik tworzy kompletną strukturę.
 *
 * WAŻNE — Zasady edycji:
 *  1. Nowa tabela   → dodaj do tego pliku WERSJA + napisz migrate-up
 *  2. Nowa kolumna → dodaj tu ORAZ napisz migrate-up z ALTER TABLE
 *  3. Nigdy nie usuwaj kolumny — dodawaj nowe z `IF NOT EXISTS` w migrate
 *  4. Nowy indeks  → dodaj tu WERSJA i w migrate-up
 */

// ── Workspaces ──────────────────────────────────────────────────────────────────

export const schema = `
-- 1. WORKSPACES
-- Multi-tenant isolation. All resources belong to a workspace.
CREATE TABLE IF NOT EXISTS workspaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  description TEXT,
  icon       TEXT DEFAULT '📁',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 2. AGENTS
-- AI agents (Lex COO, Lex Intake, Lex Research, Lex Draft, Lex Control, Lex Memory).
-- Workspace-scoped via workspace_id.
CREATE TABLE IF NOT EXISTS agents (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  description   TEXT,
  avatar_emoji  TEXT DEFAULT '🤖',
  status        TEXT DEFAULT 'standby'    CHECK (status IN ('standby', 'busy', 'offline')),
  is_master     INTEGER DEFAULT 0,
  workspace_id  TEXT DEFAULT 'default'   REFERENCES workspaces(id),
  soul_md       TEXT,
  user_md       TEXT,
  agents_md     TEXT,
  heartbeat_md  TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- 3. CLIENTS
-- End clients (law firm customers). Workspace-scoped via default workspace.
CREATE TABLE IF NOT EXISTS clients (
  id                TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  email             TEXT,
  phone             TEXT,
  telegram_id       TEXT,
  telegram_username TEXT,
  contact_info      TEXT,
  notes             TEXT,
  user_id           TEXT,                               -- owning user (migration-012)
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- 4. PROJECTS
-- Work items / matters linked to a client.
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  description   TEXT,
  status        TEXT DEFAULT 'active'    CHECK (status IN ('active', 'on_hold', 'archived')),
  client_id     TEXT                     REFERENCES clients(id) ON DELETE SET NULL,
  project_type  TEXT,                                 -- migration-015
  tags          TEXT,                                  -- migration-015
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

-- 5. TASKS  (Mission Queue)
-- Core work items. Can be linked to a client, project, and assigned to an agent.
CREATE TABLE IF NOT EXISTS tasks (
  id                     TEXT PRIMARY KEY,
  title                  TEXT NOT NULL,
  description            TEXT,
  status                 TEXT DEFAULT 'not_started'
    CHECK (status IN (
      'not_started', 'intake', 'research', 'drafting',
      'review', 'testing', 'client_input', 'awaiting_approval',
      'done', 'cancelled', 'blocked', 'planning'
    )),
  priority               TEXT DEFAULT 'normal'  CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  sub_status             TEXT,                              -- migration-009
  assigned_agent_id      TEXT                               REFERENCES agents(id),
  created_by_agent_id    TEXT                               REFERENCES agents(id),
  workspace_id           TEXT DEFAULT 'default'             REFERENCES workspaces(id),
  client_id              TEXT                               REFERENCES clients(id)  ON DELETE SET NULL,
  project_id             TEXT                               REFERENCES projects(id) ON DELETE SET NULL,
  due_date               TEXT,
  source                 TEXT DEFAULT 'mc',                 -- migration-006: 'mc' | 'notion'
  notion_page_id         TEXT,                              -- migration-004a1
  notion_last_synced     TEXT,                              -- migration-004a1
  business_id            TEXT DEFAULT 'default',
  -- Planning session fields (migration-004, 004a)
  planning_session_key   TEXT,
  planning_messages      TEXT,                              -- JSON array
  planning_complete      INTEGER DEFAULT 0,
  planning_spec          TEXT,                              -- JSON
  planning_agents        TEXT,                              -- JSON array
  created_at             TEXT DEFAULT (datetime('now')),
  updated_at             TEXT DEFAULT (datetime('now'))
);

-- 6. PLANNING_QUESTIONS
-- Questions asked during the planning phase of a task.
CREATE TABLE IF NOT EXISTS planning_questions (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL  REFERENCES tasks(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  question      TEXT NOT NULL,
  question_type TEXT DEFAULT 'multiple_choice'
    CHECK (question_type IN ('multiple_choice', 'text', 'yes_no')),
  options       TEXT,
  answer        TEXT,
  answered_at   TEXT,
  sort_order    INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- 7. PLANNING_SPECS
-- Locked specification document produced during planning phase.
CREATE TABLE IF NOT EXISTS planning_specs (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL UNIQUE  REFERENCES tasks(id) ON DELETE CASCADE,
  spec_markdown TEXT NOT NULL,
  locked_at     TEXT NOT NULL,
  locked_by     TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- 8. BUSINESSES  (legacy — kept for compatibility, not actively used)
CREATE TABLE IF NOT EXISTS businesses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 9. OPENCLAW SESSIONS
-- Maps MC task sessions to OpenClaw Gateway session IDs.
CREATE TABLE IF NOT EXISTS openclaw_sessions (
  id                  TEXT PRIMARY KEY,
  agent_id            TEXT    REFERENCES agents(id),
  openclaw_session_id TEXT NOT NULL,
  channel             TEXT,
  status              TEXT DEFAULT 'active',
  session_type        TEXT DEFAULT 'persistent'  CHECK (session_type IN ('persistent', 'subagent', 'planning')),
  task_id             TEXT    REFERENCES tasks(id),
  ended_at            TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

-- 10. EVENTS  (live feed)
CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  agent_id   TEXT    REFERENCES agents(id),
  task_id    TEXT    REFERENCES tasks(id),
  message    TEXT NOT NULL,
  metadata   TEXT,                               -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- 11. TASK_ACTIVITIES  (real-time activity log per task)
CREATE TABLE IF NOT EXISTS task_activities (
  id            TEXT PRIMARY KEY,
  task_id       TEXT NOT NULL  REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id      TEXT           REFERENCES agents(id),
  activity_type TEXT NOT NULL,
  message       TEXT NOT NULL,
  metadata      TEXT,                               -- JSON
  created_at    TEXT DEFAULT (datetime('now'))
);

-- 12. TASK_DELIVERABLES  (files, URLs, artifacts produced by agents)
CREATE TABLE IF NOT EXISTS task_deliverables (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL  REFERENCES tasks(id) ON DELETE CASCADE,
  deliverable_type TEXT NOT NULL,
  title            TEXT NOT NULL,
  path             TEXT,
  file_path        TEXT,                           -- migration-012
  file_name        TEXT,                           -- migration-012
  file_size        INTEGER,                        -- migration-012
  file_mime        TEXT,                           -- migration-012
  url              TEXT,                           -- migration-012
  description      TEXT,
  agent_id         TEXT,                           -- migration-012
  created_at       TEXT DEFAULT (datetime('now'))
);

-- 13. TASK_ATTACHMENTS  (files, links, notes attached to a task)
CREATE TABLE IF NOT EXISTS task_attachments (
  id               TEXT PRIMARY KEY,
  task_id          TEXT NOT NULL  REFERENCES tasks(id) ON DELETE CASCADE,
  attachment_type  TEXT NOT NULL  CHECK (attachment_type IN ('file', 'link', 'note')),
  title            TEXT NOT NULL,
  url              TEXT,
  file_path        TEXT,
  file_name        TEXT,
  file_size        INTEGER,
  file_mime        TEXT,
  content          TEXT,
  description      TEXT,
  uploaded_by      TEXT DEFAULT 'user',
  kb_scope         TEXT DEFAULT 'task',           -- migration-012
  scope_id         TEXT,                          -- migration-012
  agent_id         TEXT,                          -- migration-012
  is_deletable     INTEGER DEFAULT 1,             -- migration-012
  created_at       TEXT DEFAULT (datetime('now'))
);

-- 14. CLIENT_ATTACHMENTS  (files attached directly to a client)
CREATE TABLE IF NOT EXISTS client_attachments (
  id               TEXT PRIMARY KEY,
  client_id        TEXT NOT NULL,
  attachment_type  TEXT NOT NULL  CHECK (attachment_type IN ('file', 'link', 'note')),
  title            TEXT NOT NULL,
  url              TEXT,
  file_path        TEXT,
  file_name        TEXT,
  file_size        INTEGER,
  file_mime        TEXT,
  content          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 15. PROJECT_ATTACHMENTS  (files attached directly to a project)
CREATE TABLE IF NOT EXISTS project_attachments (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL,
  attachment_type  TEXT NOT NULL  CHECK (attachment_type IN ('file', 'link', 'note')),
  title            TEXT NOT NULL,
  url              TEXT,
  file_path        TEXT,
  file_name        TEXT,
  file_size        INTEGER,
  file_mime        TEXT,
  content          TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 16. CONVERSATIONS  (agent-to-agent chat, or task-scoped)
CREATE TABLE IF NOT EXISTS conversations (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  type       TEXT DEFAULT 'direct'  CHECK (type IN ('direct', 'group', 'task')),
  task_id    TEXT                    REFERENCES tasks(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- 17. CONVERSATION_PARTICIPANTS
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT  REFERENCES conversations(id) ON DELETE CASCADE,
  agent_id        TEXT  REFERENCES agents(id) ON DELETE CASCADE,
  joined_at       TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (conversation_id, agent_id)
);

-- 18. MESSAGES  (within a conversation)
CREATE TABLE IF NOT EXISTS messages (
  id               TEXT PRIMARY KEY,
  conversation_id  TEXT  REFERENCES conversations(id) ON DELETE CASCADE,
  sender_agent_id  TEXT  REFERENCES agents(id),
  content          TEXT NOT NULL,
  message_type     TEXT DEFAULT 'text'  CHECK (message_type IN ('text', 'system', 'task_update', 'file')),
  metadata         TEXT,
  created_at       TEXT DEFAULT (datetime('now'))
);

-- 19. CLIENT_MESSAGES  (external comms: email, Telegram)
CREATE TABLE IF NOT EXISTS client_messages (
  id          TEXT PRIMARY KEY,
  task_id     TEXT    REFERENCES tasks(id) ON DELETE SET NULL,
  channel     TEXT NOT NULL  CHECK (channel IN ('email', 'telegram')),
  direction   TEXT NOT NULL  CHECK (direction IN ('inbound', 'outbound')),
  sender      TEXT,
  recipient   TEXT,
  subject     TEXT,
  body        TEXT NOT NULL,
  message_id  TEXT,
  metadata    TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 20. KNOWLEDGE_ENTRIES  (searchable legal knowledge base)
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  content              TEXT NOT NULL,
  kb_scope             TEXT NOT NULL  CHECK (kb_scope IN ('global', 'client', 'project', 'task')),
  scope_id             TEXT,
  entry_type           TEXT DEFAULT 'document',
  tags                 TEXT,                                -- comma-separated or JSON array
  metadata             TEXT,                                -- JSON
  embedding_id         TEXT,                               -- vector store reference
  status               TEXT DEFAULT 'pending'
    CHECK (status IN ('indexed', 'pending', 'failed', 'deleting')),
  created_by           TEXT,
  created_at           TEXT DEFAULT (datetime('now')),
  updated_at           TEXT DEFAULT (datetime('now'))
);

-- 21. AGENT_LESSONS  (learned lessons / post-mortems per agent)
CREATE TABLE IF NOT EXISTS agent_lessons (
  id         TEXT PRIMARY KEY,
  agent_id   TEXT NOT NULL,
  lesson     TEXT NOT NULL,
  category   TEXT DEFAULT 'general',
  matter_id  TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 22. AGENT_MEMORY  (files, documents, structured memories per agent)
CREATE TABLE IF NOT EXISTS agent_memory (
  id          TEXT PRIMARY KEY,
  agent_id    TEXT NOT NULL,
  memory_type TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT,
  file_path   TEXT,
  file_name   TEXT,
  file_size   INTEGER,
  file_mime   TEXT,
  url         TEXT,
  tags        TEXT,
  metadata    TEXT,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- 23. CASE_MESSAGES  (agent-to-agent discussion within a case/task)
CREATE TABLE IF NOT EXISTS case_messages (
  id              TEXT PRIMARY KEY,
  task_id         TEXT NOT NULL,
  sender_type     TEXT NOT NULL,
  sender_id       TEXT NOT NULL,
  sender_name     TEXT NOT NULL,
  content         TEXT NOT NULL,
  message_format  TEXT DEFAULT 'text',
  metadata        TEXT,
  is_ai_response  INTEGER DEFAULT 0,
  created_at      TEXT DEFAULT (datetime('now'))
);

-- 24. CASE_TIMELINE  (real-time audit trail per case/task)
CREATE TABLE IF NOT EXISTS case_timeline (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  event_type  TEXT NOT NULL,
  actor_type  TEXT,
  actor_id    TEXT,
  actor_name  TEXT,
  description TEXT NOT NULL,
  metadata    TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 25. CASE_LINKS  (external URLs linked to a case)
CREATE TABLE IF NOT EXISTS case_links (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL,
  link_type   TEXT NOT NULL,
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT,
  created_by  TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- 26. USERS  (dashboard users with RBAC)
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name         TEXT NOT NULL,
  role         TEXT NOT NULL,                     -- 'admin' | 'worker' | 'viewer'
  avatar_url   TEXT,
  is_active    INTEGER DEFAULT 1,
  last_login   TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- 27. USER_CLIENT_ACCESS  (RBAC — which users can access which clients)
CREATE TABLE IF NOT EXISTS user_client_access (
  user_id     TEXT NOT NULL,
  client_id   TEXT NOT NULL,
  granted_by  TEXT,
  granted_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, client_id)
);

-- 28. USER_PROJECT_ACCESS  (RBAC — which users can access which projects)
CREATE TABLE IF NOT EXISTS user_project_access (
  user_id     TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  granted_by  TEXT,
  granted_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, project_id)
);

-- 29. CLIENT_PROJECTS  (many-to-many: a client can have multiple projects)
CREATE TABLE IF NOT EXISTS client_projects (
  client_id   TEXT NOT NULL,
  project_id  TEXT NOT NULL,
  role        TEXT DEFAULT 'owner',
  created_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (client_id, project_id)
);

-- 30. PROJECT_KNOWLEDGE  (many-to-many: explicit project<->knowledge links)
CREATE TABLE IF NOT EXISTS project_knowledge (
  project_id        TEXT NOT NULL  REFERENCES projects(id) ON DELETE CASCADE,
  knowledge_entry_id TEXT NOT NULL  REFERENCES knowledge_entries(id) ON DELETE CASCADE,
  added_by          TEXT,
  added_at          TEXT DEFAULT (datetime('now')),
  relevance_score   REAL DEFAULT 0,
  PRIMARY KEY (project_id, knowledge_entry_id)
);

-- 31. _MIGRATIONS  (internal — tracks which migrations have been applied)
CREATE TABLE IF NOT EXISTS _migrations (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT DEFAULT (datetime('now'))
);

-- ── INDEXES ─────────────────────────────────────────────────────────────────────

-- workspaces
CREATE INDEX IF NOT EXISTS idx_agents_workspace      ON agents(workspace_id);

-- tasks
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned         ON tasks(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace         ON tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_client           ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project          ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_notion           ON tasks(notion_page_id) WHERE notion_page_id IS NOT NULL;

-- agents
CREATE INDEX IF NOT EXISTS idx_agents_status          ON agents(status);

-- planning
CREATE INDEX IF NOT EXISTS idx_planning_questions_task ON planning_questions(task_id, sort_order);

-- conversations / messages
CREATE INDEX IF NOT EXISTS idx_messages_conversation  ON messages(conversation_id);

-- events
CREATE INDEX IF NOT EXISTS idx_events_created        ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_task           ON events(task_id);

-- openclaw_sessions
CREATE INDEX IF NOT EXISTS idx_openclaw_sessions_task ON openclaw_sessions(task_id);

-- task_activities
CREATE INDEX IF NOT EXISTS idx_activities_task        ON task_activities(task_id, created_at DESC);

-- task_deliverables
CREATE INDEX IF NOT EXISTS idx_deliverables_task      ON task_deliverables(task_id);

-- task_attachments
CREATE INDEX IF NOT EXISTS idx_attachments_task       ON task_attachments(task_id, created_at DESC);

-- clients
CREATE INDEX IF NOT EXISTS idx_clients_telegram      ON clients(telegram_id);
CREATE INDEX IF NOT EXISTS idx_clients_email         ON clients(email);

-- projects
CREATE INDEX IF NOT EXISTS idx_projects_client       ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_status        ON projects(status);

-- client_attachments
CREATE INDEX IF NOT EXISTS idx_client_attachments_client_id ON client_attachments(client_id);

-- project_attachments
CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id ON project_attachments(project_id);

-- knowledge_entries
CREATE INDEX IF NOT EXISTS idx_ke_scope              ON knowledge_entries(kb_scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_ke_embedding           ON knowledge_entries(embedding_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_status       ON knowledge_entries(status);

-- agent_lessons
CREATE INDEX IF NOT EXISTS idx_agent_lessons_agent   ON agent_lessons(agent_id, created_at DESC);

-- agent_memory
CREATE INDEX IF NOT EXISTS idx_am_agent              ON agent_memory(agent_id, memory_type);

-- case_messages
CREATE INDEX IF NOT EXISTS idx_cm_task               ON case_messages(task_id, created_at DESC);

-- case_timeline
CREATE INDEX IF NOT EXISTS idx_ct_task               ON case_timeline(task_id, created_at DESC);

-- case_links
CREATE INDEX IF NOT EXISTS idx_cl_task               ON case_links(task_id);

-- client_messages
CREATE INDEX IF NOT EXISTS idx_client_messages_task   ON client_messages(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_messages_channel ON client_messages(channel, created_at DESC);

-- users
CREATE INDEX IF NOT EXISTS idx_users_email            ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role             ON users(role);

-- client_projects
CREATE INDEX IF NOT EXISTS idx_cp_client             ON client_projects(client_id);
CREATE INDEX IF NOT EXISTS idx_cp_project             ON client_projects(project_id);

-- project_knowledge
CREATE INDEX IF NOT EXISTS idx_project_knowledge_entry ON project_knowledge(knowledge_entry_id);
`;
