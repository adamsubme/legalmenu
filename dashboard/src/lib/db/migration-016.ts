import type Database from 'better-sqlite3';

/**
 * Migration 016: Add project_knowledge junction table
 *
 * This table links knowledge entries to projects, enabling per-project
 * knowledge scoping that supplements the kb_scope='project' filtering.
 */
export const migration016 = {
  id: '016',
  name: 'add_project_knowledge',
  up: (db: Database.Database) => {
    console.log('[Migration 016] Adding project_knowledge junction table...');

    // Create the junction table
    db.exec(`
      CREATE TABLE IF NOT EXISTS project_knowledge (
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        knowledge_entry_id TEXT NOT NULL REFERENCES knowledge_entries(id) ON DELETE CASCADE,
        added_by TEXT,
        added_at TEXT DEFAULT (datetime('now')),
        relevance_score REAL DEFAULT 0,
        PRIMARY KEY (project_id, knowledge_entry_id)
      )
    `);

    // Create index for reverse lookups
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_project_knowledge_entry
      ON project_knowledge(knowledge_entry_id)
    `);

    console.log('[Migration 016] project_knowledge table created');
  },
};
