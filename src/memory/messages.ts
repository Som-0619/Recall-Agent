import crypto from 'crypto';
import { getDb } from '../database/db';

export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  created_at: string;
}

/**
 * Saves a new message to a conversation and updates the conversation's updated_at timestamp.
 */
export function saveMessage(
  conversationId: string,
  role: MessageRole,
  content: string
): Message {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Run in a transaction to insert the message and update the conversation timestamp atomically
  const saveTx = db.transaction(() => {
    const insertStmt = db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertStmt.run(id, conversationId, role, content, now);

    const updateConvStmt = db.prepare(`
      UPDATE conversations
      SET updated_at = ?
      WHERE id = ?
    `);
    updateConvStmt.run(now, conversationId);
  });

  saveTx();

  return {
    id,
    conversation_id: conversationId,
    role,
    content,
    created_at: now,
  };
}

/**
 * Retrieves all messages in a conversation in chronological order (oldest to newest).
 */
export function getMessages(conversationId: string): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, conversation_id, role, content, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC, rowid ASC
  `);

  return stmt.all(conversationId) as Message[];
}

/**
 * Retrieves the most recent messages up to the limit, returned in chronological order.
 */
export function getRecentMessages(conversationId: string, limit: number = 10): Message[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, conversation_id, role, content, created_at
    FROM (
      SELECT id, conversation_id, role, content, created_at, rowid
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    )
    ORDER BY created_at ASC, rowid ASC
  `);

  return stmt.all(conversationId, limit) as Message[];
}

/**
 * Retrieves messages matching a specific calendar date (YYYY-MM-DD) for a conversation.
 */
export function getMessagesByDate(
  conversationId: string,
  dateStr: string,
  limit: number = 10
): Message[] {
  const db = getDb();
  try {
    const stmt = db.prepare(`
      SELECT id, conversation_id, role, content, created_at
      FROM messages
      WHERE conversation_id = ? AND date(created_at) = date(?)
      ORDER BY created_at ASC, rowid ASC
      LIMIT ?
    `);

    return stmt.all(conversationId, dateStr, limit) as Message[];
  } catch {
    return [];
  }
}

/**
 * Searches messages using SQLite FTS5 full-text search.
 * Safely handles empty/malformed queries and returns messages with relevance ranking.
 */
export function searchMessages(query: string, limit: number = 20): Message[] {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  // Tokenize and sanitize input terms to prevent FTS5 syntax errors
  const tokens = query
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return [];
  }

  // Format as OR-separated prefix matches so partial sentence tokens match and rank by BM25 relevance
  const ftsQuery = tokens.map((token) => `"${token}"*`).join(' OR ');

  const db = getDb();
  try {
    const stmt = db.prepare(`
      SELECT m.id, m.conversation_id, m.role, m.content, m.created_at
      FROM messages_fts fts
      JOIN messages m ON m.id = fts.id
      WHERE messages_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    return stmt.all(ftsQuery, limit) as Message[];
  } catch (error) {
    // If FTS encounters an unexpected query error, return empty array safely
    console.error('FTS search error:', error);
    return [];
  }
}
