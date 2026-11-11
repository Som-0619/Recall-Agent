import crypto from 'crypto';
import { getDb } from '../database/db';

export type MemoryType = 'fact' | 'decision' | 'preference' | 'constraint';

export interface Memory {
  id: string;
  conversation_id: string;
  type: MemoryType;
  subject: string;
  content: string;
  source_message_id: string | null;
  created_at: string;
}

export interface SaveMemoryData {
  conversation_id: string;
  type: MemoryType;
  subject: string;
  content: string;
  source_message_id?: string | null;
}

/**
 * Saves a structured memory linked to a conversation and optionally a source message.
 */
export function saveMemory(data: SaveMemoryData): Memory {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const sourceMessageId = data.source_message_id || null;

  const stmt = db.prepare(`
    INSERT INTO memories (id, conversation_id, type, subject, content, source_message_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.conversation_id,
    data.type,
    data.subject.trim(),
    data.content.trim(),
    sourceMessageId,
    now
  );

  return {
    id,
    conversation_id: data.conversation_id,
    type: data.type,
    subject: data.subject.trim(),
    content: data.content.trim(),
    source_message_id: sourceMessageId,
    created_at: now,
  };
}

/**
 * Retrieves all memories for a given conversation.
 */
export function getMemories(conversationId: string): Memory[] {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id, conversation_id, type, subject, content, source_message_id, created_at
    FROM memories
    WHERE conversation_id = ?
    ORDER BY created_at ASC
  `);

  return stmt.all(conversationId) as Memory[];
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'what', 'which', 'who', 'how',
  'did', 'we', 'our', 'my', 'do', 'does', 'earlier', 'previous'
]);

/**
 * Searches memories across subject and content using keyword matching.
 */
export function searchMemories(query: string, limit: number = 20): Memory[] {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    return [];
  }

  const db = getDb();
  const trimmed = query.trim();

  // Extract non-trivial search keywords (removing conversational stop words)
  const keywords = trimmed
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 2 && !STOP_WORDS.has(k.toLowerCase()));

  // Fallback to the full query pattern if all terms were filtered
  const searchTerms = keywords.length > 0 ? keywords : [trimmed];
  const conditions = searchTerms.map(() => '(subject LIKE ? OR content LIKE ?)').join(' OR ');
  const params: string[] = searchTerms.flatMap((term) => [`%${term}%`, `%${term}%`]);

  const stmt = db.prepare(`
    SELECT id, conversation_id, type, subject, content, source_message_id, created_at
    FROM memories
    WHERE ${conditions}
    ORDER BY created_at DESC
    LIMIT ?
  `);

  return stmt.all(...params, limit) as Memory[];
}

/**
 * Deletes a memory by its unique ID.
 */
export function deleteMemory(id: string): boolean {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM memories
    WHERE id = ?
  `);

  const info = stmt.run(id);
  return info.changes > 0;
}

