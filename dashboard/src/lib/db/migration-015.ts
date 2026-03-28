import type Database from 'better-sqlite3';

/**
 * Migration 015: Add project_type, tags, and linked_clients to projects
 */
export const migration015 = {
  id: '015',
  name: 'project_extensions',
  up: (db: Database.Database) => {
    // Add project_type column
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN project_type TEXT`);
    } catch (e) {
      // Column might already exist
    }
    
    // Add tags column
    try {
      db.exec(`ALTER TABLE projects ADD COLUMN tags TEXT`);
    } catch (e) {
      // Column might already exist
    }

    console.log('[Migration 015] Added project_type and tags columns');
  }
};
