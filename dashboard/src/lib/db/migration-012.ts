import type Database from 'better-sqlite3';

/**
 * Migration 012: Complete system redesign
 * 
 * Simplified version - removes CHECK constraints that SQLite doesn't handle well in ALTER TABLE
 */
export const migration012 = {
  id: '012',
  name: 'complete_system_redesign',
  up: (db: Database.Database) => {
    console.log('[Migration 012] Starting complete system redesign...');

    // ============================================
    // 1. USERS & RBAC
    // ============================================
    console.log('[Migration 012] Creating users and RBAC tables...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        avatar_url TEXT,
        is_active INTEGER DEFAULT 1,
        last_login TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);

    // Worker access to clients
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_client_access (
        user_id TEXT NOT NULL,
        client_id TEXT NOT NULL,
        granted_by TEXT,
        granted_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, client_id)
      )
    `);

    // Worker access to projects
    db.exec(`
      CREATE TABLE IF NOT EXISTS user_project_access (
        user_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        granted_by TEXT,
        granted_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (user_id, project_id)
      )
    `);

    // ============================================
    // 2. MANY-TO-MANY: CLIENTS <-> PROJECTS
    // ============================================
    console.log('[Migration 012] Creating client_projects junction table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS client_projects (
        client_id TEXT NOT NULL,
        project_id TEXT NOT NULL,
        role TEXT DEFAULT 'owner',
        created_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (client_id, project_id)
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cp_client ON client_projects(client_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cp_project ON client_projects(project_id)`);

    // ============================================
    // 3. KNOWLEDGE HIERARCHY
    // ============================================
    console.log('[Migration 012] Creating knowledge_entries table...');

    // Drop old table if it exists with incompatible schema
    try {
      db.exec(`DROP TABLE IF EXISTS knowledge_entries`);
    } catch (e) {
      console.log('[Migration 012] Could not drop old knowledge_entries table');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        kb_scope TEXT NOT NULL,
        scope_id TEXT,
        entry_type TEXT DEFAULT 'document',
        tags TEXT,
        metadata TEXT,
        embedding_id TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_scope ON knowledge_entries(kb_scope, scope_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ke_embedding ON knowledge_entries(embedding_id)`);

    // ============================================
    // 4. CASE CHAT (Agent Discussions)
    // ============================================
    console.log('[Migration 012] Creating case_messages table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS case_messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT NOT NULL,
        content TEXT NOT NULL,
        message_format TEXT DEFAULT 'text',
        metadata TEXT,
        is_ai_response INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cm_task ON case_messages(task_id, created_at DESC)`);

    // ============================================
    // 5. CASE TIMELINE (Real-time Tracking)
    // ============================================
    console.log('[Migration 012] Creating case_timeline table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS case_timeline (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_type TEXT,
        actor_id TEXT,
        actor_name TEXT,
        description TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ct_task ON case_timeline(task_id, created_at DESC)`);

    // ============================================
    // 6. AGENT MEMORY (Files & Lessons)
    // ============================================
    console.log('[Migration 012] Creating agent_memory table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_memory (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        memory_type TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        file_mime TEXT,
        url TEXT,
        tags TEXT,
        metadata TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_am_agent ON agent_memory(agent_id, memory_type)`);

    // ============================================
    // 7. ENHANCED TASK ATTACHMENTS
    // ============================================
    console.log('[Migration 012] Enhancing task_attachments table...');

    try {
      db.exec(`ALTER TABLE task_attachments ADD COLUMN kb_scope TEXT DEFAULT 'task'`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_attachments ADD COLUMN scope_id TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_attachments ADD COLUMN agent_id TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_attachments ADD COLUMN is_deletable INTEGER DEFAULT 1`);
    } catch (e) { /* column may exist */ }

    // ============================================
    // 8. DELIVERABLES
    // ============================================
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN file_path TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN file_name TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN file_size INTEGER`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN file_mime TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN url TEXT`);
    } catch (e) { /* column may exist */ }
    try {
      db.exec(`ALTER TABLE task_deliverables ADD COLUMN agent_id TEXT`);
    } catch (e) { /* column may exist */ }

    // ============================================
    // 9. CASE LINKS
    // ============================================
    db.exec(`
      CREATE TABLE IF NOT EXISTS case_links (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        link_type TEXT NOT NULL,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        description TEXT,
        created_by TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_cl_task ON case_links(task_id)`);

    // ============================================
    // 10. PROJECT KNOWLEDGE LINK
    // ============================================
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_knowledge (
        project_id TEXT NOT NULL,
        knowledge_entry_id TEXT NOT NULL,
        relevance_score REAL DEFAULT 1.0,
        added_by TEXT,
        added_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (project_id, knowledge_entry_id)
      )
    `);

    // ============================================
    // 11. CLIENT USER_ID
    // ============================================
    try {
      db.exec(`ALTER TABLE clients ADD COLUMN user_id TEXT`);
    } catch (e) { /* column may exist */ }

    console.log('[Migration 012] Complete system redesign finished successfully');
  }
};
