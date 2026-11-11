import crypto from 'crypto';
import { getDb } from '../database/db';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

/**
 * Creates a new conversation and persists it in the database.
 */
export function createConversation(title: string): Conversation {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO conversations (id, title, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(id, title.trim(), now, now);

  return {
    id,
    title: title.trim(),
    created_at: now,
    updated_at: now,
  };
}

/**
 * Retrieves a conversation by its unique ID. Returns null if not found.
 */
export function getConversation(id: string): Conversation | null {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    WHERE id = ?
  `);

  const row = stmt.get(id) as Conversation | undefined;
  return row || null;
}

/**
 * Lists all conversations ordered by the most recently updated.
 */
export function listConversations(): Conversation[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, title, created_at, updated_at
    FROM conversations
    ORDER BY updated_at DESC
  `);

  return stmt.all() as Conversation[];
}

/**
 * Updates the title of an existing conversation. Returns the updated conversation, or null if not found.
 */
export function updateConversation(id: string, title: string): Conversation | null {
  const db = getDb();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    UPDATE conversations
    SET title = ?, updated_at = ?
    WHERE id = ?
  `);

  const info = stmt.run(title.trim(), now, id);
  if (info.changes === 0) {
    return null;
  }

  return getConversation(id);
}

/**
 * Deletes a conversation by its ID.
 * SQLite foreign key ON DELETE CASCADE automatically removes its messages and memories.
 */
export function deleteConversation(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM conversations
    WHERE id = ?
  `);

  const info = stmt.run(id);
  return info.changes > 0;
}

