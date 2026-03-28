import Database from 'better-sqlite3';

export function migration014(db: Database.Database): void {
  // Create project_attachments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_attachments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
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
    CREATE INDEX IF NOT EXISTS idx_project_attachments_project_id ON project_attachments(project_id);
  `);

  console.log('[Migration 014] Created project_attachments table');
}
