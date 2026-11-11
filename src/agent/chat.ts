import { getConversation } from '../memory/conversation';
import { saveMessage } from '../memory/messages';
import { saveMemory, getMemories } from '../memory/memories';
import { buildConversationContext } from './context';
import { generateResponseWithTools } from './gemini';
import { extractMemories } from './memory-extractor';
import { SearchResult } from '../tools/web-search';

export interface ChatResult {
  conversation_id: string;
  user_message_id: string;
  reply: string;
  saved_memories: number;
  sources: SearchResult[];
}

const SYSTEM_PROMPT = `You are Recall, a conversational AI research assistant with persistent memory and internet research capabilities.

Core Guidelines:
1. Be conversational, helpful, and direct. Avoid unnecessary fluff.
2. Use the provided conversation history and saved memories to maintain continuity.
3. Distinguish established historical facts and decisions from assumptions.
4. Never invent prior discussions. If historical context is missing, acknowledge that you do not have that prior record.
5. Answer general or conceptual questions directly from your knowledge without searching the web (e.g. "What is RAG?").
6. Use the web_search tool ONLY when needed for:
   - Current events or recent announcements.
   - Pricing changes and product updates.
   - Specific release notes or changelogs.
   - Verifying whether previous facts or assumptions are still accurate.
7. Citation and Research Rules:
   - When web search results are provided, cite the relevant sources using numbered brackets like [1], [2] corresponding to the search results.
   - Never invent or fabricate URLs or citations.
   - Only cite a source if it genuinely supports the claim.
   - Distinguish publication dates from retrieval dates. If a publication date is unavailable, say so rather than guessing.
   - Do not claim an update is brand new just because a search result was recently indexed.
   - If sources conflict or search snippets are inconclusive, explicitly mention the uncertainty.
   - If web search yields no results or fails, clearly disclose that current information could not be verified rather than asserting outdated knowledge as fresh.`;

/**
 * Orchestrates conversation flow: verifies conversation, saves user message,
 * retrieves context, calls Gemini with tool calling, saves assistant reply,
 * extracts structured memories, and returns response with citations.
 */
export async function chat(
  conversationId: string,
  userMessage: string
): Promise<ChatResult> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    throw new Error('Message cannot be empty');
  }

  // 1. Verify the conversation exists
  const conversation = getConversation(conversationId);
  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // 2. Build historical context BEFORE inserting the current user message
  // This guarantees the current user message is not duplicated inside the retrieved recent history
  const context = buildConversationContext(conversationId, trimmed);

  // 3. Persist the current user message before making any external API call to guarantee durability
  const userMsg = saveMessage(conversationId, 'user', trimmed);

  // 4. Build prompt
  const today = new Date().toISOString().split('T')[0];
  let fullPrompt = `${SYSTEM_PROMPT}\n\nCurrent Date: ${today}\n\n`;
  if (context.trim()) {
    fullPrompt += `--- RETRIEVED CONVERSATION CONTEXT ---\n${context}\n\n`;
  }
  fullPrompt += `USER: ${trimmed}\n\nASSISTANT:`;

  // 5, 6, 7. Generate response using native tool-calling loop (web_search)
  const { text: reply, sources } = await generateResponseWithTools(fullPrompt);

  // 8. Save assistant reply
  saveMessage(conversationId, 'assistant', reply);

  // 9. Extract important memories from user message
  const extracted = await extractMemories(trimmed, conversationId, userMsg.id);

  // Save valid extracted memories into SQLite without duplicates
  const existingMemories = getMemories(conversationId);
  let savedCount = 0;

  for (const memory of extracted) {
    const isDuplicate = existingMemories.some(
      (m) =>
        m.subject.toLowerCase() === memory.subject.toLowerCase() &&
        m.content.toLowerCase() === memory.content.toLowerCase()
    );

    if (!isDuplicate) {
      saveMemory({
        conversation_id: conversationId,
        type: memory.type,
        subject: memory.subject,
        content: memory.content,
        source_message_id: memory.source_message_id,
      });
      savedCount++;
    }
  }

  // 10. Return response and structured sources
  return {
    conversation_id: conversationId,
    user_message_id: userMsg.id,
    reply,
    saved_memories: savedCount,
    sources,
  };
}
