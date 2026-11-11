import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

let dbInstance: Database.Database | null = null;

/**
 * Initializes the SQLite database, establishes pragmas, and creates
 * required tables, indexes, FTS5 virtual table, and sync triggers.
 */
export function initDatabase(dbPath: string = env.DATABASE_PATH): Database.Database {
  // Ensure the directory exists when using a file-based path
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  // Use WAL mode for file-based databases to improve concurrent read/write performance
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Schema creation
  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
    ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('fact', 'decision', 'preference', 'constraint')),
      subject TEXT NOT NULL,
      content TEXT NOT NULL,
      source_message_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (source_message_id) REFERENCES messages(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_memories_conversation
    ON memories(conversation_id);

    -- FTS5 full-text search table for messages
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      id UNINDEXED,
      conversation_id UNINDEXED,
      content
    );

    -- Keep FTS5 index synchronized with messages table
    CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts(id, conversation_id, content)
      VALUES (new.id, new.conversation_id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
    END;

    CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE ON messages BEGIN
      DELETE FROM messages_fts WHERE id = old.id;
      INSERT INTO messages_fts(id, conversation_id, content)
      VALUES (new.id, new.conversation_id, new.content);
    END;
  `);

  dbInstance = db;
  return db;
}

/**
 * Returns the current active database instance, initializing it if necessary.
 */
export function getDb(): Database.Database {
  if (!dbInstance) {
    dbInstance = initDatabase();
  }
  return dbInstance;
}

/**
 * Closes the active database connection (useful for tests and graceful shutdown).
 */
export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

