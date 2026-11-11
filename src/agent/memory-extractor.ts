import { z } from 'zod';
import { generateResponse } from './gemini';
import { MemoryType } from '../memory/memories';

// Zod schema to validate memory items returned by Gemini
const memoryItemSchema = z.object({
  type: z.enum(['fact', 'decision', 'preference', 'constraint']),
  subject: z.string().min(1, 'Subject cannot be empty'),
  content: z.string().min(1, 'Content cannot be empty'),
});

const extractedMemoriesSchema = z.array(memoryItemSchema);

export interface ExtractedMemory {
  conversation_id: string;
  type: MemoryType;
  subject: string;
  content: string;
  source_message_id: string;
}

// Quick check for trivial greetings that should never trigger memory extraction
const TRIVIAL_MESSAGES = new Set([
  'hi',
  'hello',
  'hey',
  'good morning',
  'good afternoon',
  'good evening',
  'thanks',
  'thank you',
  'ok',
  'okay',
  'cool',
  'bye',
  'goodbye',
]);

/**
 * Extracts structured memories (facts, decisions, preferences, constraints)
 * from the user's latest message using Gemini.
 */
export async function extractMemories(
  userMessage: string,
  conversationId: string,
  messageId: string
): Promise<ExtractedMemory[]> {
  const trimmed = userMessage.trim();
  if (!trimmed) {
    return [];
  }

  // Fast-path: Ignore standard greetings without calling the API
  if (TRIVIAL_MESSAGES.has(trimmed.toLowerCase())) {
    return [];
  }

  const prompt = `You are an accurate memory extraction system for an AI assistant called Recall.
Analyze the following USER MESSAGE and extract any durable facts, decisions, preferences, or constraints explicitly stated by the user.

Rules:
1. Ignore greetings, pleasantries, questions, small talk, and unimportant conversational messages. For these, return an empty array: [].
2. Supported types: "fact", "decision", "preference", "constraint".
3. Only extract what the user explicitly stated. Never invent or assume facts not present in the text.
4. Output MUST be a valid JSON array of objects with fields:
   - "type": "fact" | "decision" | "preference" | "constraint"
   - "subject": concise summary of the topic
   - "content": the specific detail, decision, preference, or constraint
5. If no durable memories are present, return [].

USER MESSAGE:
"""
${trimmed}
"""

Return ONLY a valid JSON array.`;

  try {
    const rawResponse = await generateResponse(prompt, {
      responseMimeType: 'application/json',
    });

    // Strip code fences if present
    const cleaned = rawResponse
      .replace(/^```json\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    if (!cleaned) {
      return [];
    }

    const parsedJson = JSON.parse(cleaned);
    const validation = extractedMemoriesSchema.safeParse(parsedJson);

    if (!validation.success) {
      console.warn('Memory extraction validation warning:', validation.error.message);
      return [];
    }

    return validation.data.map((item) => ({
      conversation_id: conversationId,
      type: item.type,
      subject: item.subject.trim(),
      content: item.content.trim(),
      source_message_id: messageId,
    }));
  } catch (error) {
    // Memory extraction failure should never crash the user's chat session
    console.warn('Memory extraction skipped due to error:', error);
    return [];
  }
}

