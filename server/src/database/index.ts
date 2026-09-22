import Database, { Database as DatabaseInstance } from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config/env.js';

let dbInstance: DatabaseInstance | null = null;

export function getDatabase(): DatabaseInstance {
  if (!dbInstance) {
    const dbFilePath = path.isAbsolute(config.databasePath)
      ? config.databasePath
      : path.resolve(process.cwd(), config.databasePath);

    const dir = path.dirname(dbFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    dbInstance = new Database(dbFilePath);
    // Enable WAL mode for better concurrency and write performance
    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('foreign_keys = ON');

    initSchema(dbInstance);
  }

  return dbInstance;
}

function initSchema(db: DatabaseInstance): void {
  // Initialize foundational tables for future transactional workflows (carts, orders, customer data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    INSERT OR IGNORE INTO system_metadata (key, value)
    VALUES ('db_initialized', 'true');
  `);
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}
