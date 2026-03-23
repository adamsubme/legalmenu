import Database from 'better-sqlite3';

export const migration009 = {
  id: '009',
  name: 'v3_sub_status_knowledge_comms_lessons',
  up: (db: Database.Database) => {
    console.log('[Migration 009] Adding v3 tables and columns...');

    const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    if (!tasksInfo.some(col => col.name === 'sub_status')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN sub_status TEXT`);
      console.log('[Migration 009] Added sub_status to tasks');
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS client_messages (
        id TEXT PRIMARY KEY,
        task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
        channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram')),
        direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
        sender TEXT,
        recipient TEXT,
        subject TEXT,
        body TEXT NOT NULL,
        message_id TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_client_messages_task ON client_messages(task_id, created_at DESC)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_client_messages_channel ON client_messages(channel, created_at DESC)`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS knowledge_entries (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('file', 'link', 'document')),
        source_url TEXT,
        file_name TEXT,
        file_size INTEGER,
        vector_store_file_id TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('indexed', 'pending', 'failed', 'deleting')),
        tags TEXT,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_entries(status)`);

    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_lessons (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        lesson TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        matter_id TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_lessons_agent ON agent_lessons(agent_id, created_at DESC)`);

    console.log('[Migration 009] v3 tables created');
  }
};
