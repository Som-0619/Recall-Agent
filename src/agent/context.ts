import { getRecentMessages, searchMessages, getMessagesByDate, Message } from '../memory/messages';
import { getMemories, searchMemories, Memory } from '../memory/memories';

/**
 * Extracts a calendar date string (YYYY-MM-DD) from a user query if present.
 */
function extractDateQuery(query: string): string | null {
  // Check for ISO format: YYYY-MM-DD
  const isoMatch = query.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) {
    return isoMatch[1];
  }

  // Check for textual date format: e.g. "November 5, 2026" or "Nov 5 2026"
  const textDateMatch = query.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i
  );
  if (textDateMatch) {
    try {
      const parsed = new Date(textDateMatch[0]);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Builds a concise, deduplicated context string combining relevant memories,
 * historical search hits from SQLite FTS5 (including relevant cross-conversation memories),
 * date-specific messages, and recent dialogue.
 */
export function buildConversationContext(
  conversationId: string,
  userMessage: string
): string {
  // 1. Fetch the most recent messages in chronological order (up to 6)
  const recentMessages = getRecentMessages(conversationId, 6);
  const seenMessageIds = new Set<string>(recentMessages.map((m) => m.id));

  const historicalMessages: Message[] = [];

  // 2. Date-specific retrieval: if the query targets a calendar date, fetch messages from that date
  const targetDate = extractDateQuery(userMessage);
  if (targetDate) {
    const dateMessages = getMessagesByDate(conversationId, targetDate, 10);
    for (const msg of dateMessages) {
      if (!seenMessageIds.has(msg.id)) {
        historicalMessages.push(msg);
        seenMessageIds.add(msg.id);
      }
    }
  }

  // 3. Search SQLite FTS5 for relevant historical messages using terms from the user message
  const searchResults = searchMessages(userMessage, 5);

  for (const msg of searchResults) {
    if (!seenMessageIds.has(msg.id)) {
      historicalMessages.push(msg);
      seenMessageIds.add(msg.id);
    }
  }

  // 4. Fetch structured memories:
  // First, load all memories belonging to the current conversation
  const convMemories = getMemories(conversationId);

  // Second, search keyword-matching memories across all conversations
  const matchingMemories = searchMemories(userMessage, 5);

  const memoryMap = new Map<string, { memory: Memory; isCrossConversation: boolean }>();
  for (const m of convMemories) {
    memoryMap.set(m.id, { memory: m, isCrossConversation: false });
  }
  for (const m of matchingMemories) {
    if (!memoryMap.has(m.id)) {
      memoryMap.set(m.id, {
        memory: m,
        isCrossConversation: m.conversation_id !== conversationId,
      });
    }
  }

  const relevantMemories = Array.from(memoryMap.values()).slice(0, 10);

  // 5. Assemble formatted context sections
  const sections: string[] = [];

  if (relevantMemories.length > 0) {
    const memoryLines = relevantMemories.map(({ memory: m, isCrossConversation }) =>
      isCrossConversation
        ? `- [${m.type}] [from earlier conversation] ${m.subject}: ${m.content}`
        : `- [${m.type}] ${m.subject}: ${m.content}`
    );
    sections.push(`=== SAVED CONVERSATION MEMORIES ===\n${memoryLines.join('\n')}`);
  }

  if (historicalMessages.length > 0) {
    const historyLines = historicalMessages.map((m) =>
      m.conversation_id !== conversationId
        ? `- [${m.created_at}] [from earlier conversation] ${m.role}: ${m.content}`
        : `- [${m.created_at}] ${m.role}: ${m.content}`
    );
    sections.push(`=== RELEVANT HISTORICAL EXCERPTS ===\n${historyLines.join('\n')}`);
  }

  if (recentMessages.length > 0) {
    const recentLines = recentMessages.map(
      (m) => `- [${m.created_at}] ${m.role}: ${m.content}`
    );
    sections.push(`=== RECENT CONVERSATION HISTORY ===\n${recentLines.join('\n')}`);
  }

  return sections.join('\n\n');
}
