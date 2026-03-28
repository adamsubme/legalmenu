import type Database from 'better-sqlite3';

/**
 * Migration 013: Client attachments table
 */
export const migration013 = {
  id: '013',
  name: 'client_attachments',
  up: (db: Database.Database) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS client_attachments (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL,
        attachment_type TEXT NOT NULL CHECK (attachment_type IN ('file', 'link', 'note')),
        title TEXT NOT NULL,
        url TEXT,
        file_path TEXT,
        file_name TEXT,
        file_size INTEGER,
        file_mime TEXT,
        content TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_client_attachments_client_id ON client_attachments(client_id);
    `);

    console.log('[Migration 013] Created client_attachments table');
  }
};
