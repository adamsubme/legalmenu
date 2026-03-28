import type Database from 'better-sqlite3';

/**
 * Migration 011: Add clients and projects tables
 * 
 * This migration adds:
 * - clients table: stores client information (name, email, phone, telegram)
 * - projects table: stores projects linked to clients
 * - client_id and project_id columns in tasks table
 */
export const migration011 = {
  id: '011',
  name: 'add_clients_projects',
  up: (db: Database.Database) => {
    console.log('[Migration 011] Adding clients and projects tables...');

    // Create clients table
    db.exec(`
      CREATE TABLE IF NOT EXISTS clients (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        telegram_id TEXT,
        telegram_username TEXT,
        contact_info TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_telegram ON clients(telegram_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email)`);
    console.log('[Migration 011] Created clients table');

    // Create projects table
    db.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'archived')),
        client_id TEXT REFERENCES clients(id) ON DELETE SET NULL,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      )
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`);
    console.log('[Migration 011] Created projects table');

    // Add client_id to tasks if not exists
    const tasksInfo = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    if (!tasksInfo.some(col => col.name === 'client_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN client_id TEXT REFERENCES clients(id) ON DELETE SET NULL`);
      console.log('[Migration 011] Added client_id to tasks');
    }

    // Add project_id to tasks if not exists
    if (!tasksInfo.some(col => col.name === 'project_id')) {
      db.exec(`ALTER TABLE tasks ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL`);
      console.log('[Migration 011] Added project_id to tasks');
    }
  }
};
