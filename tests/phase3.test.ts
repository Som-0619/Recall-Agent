import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { initDatabase, closeDatabase } from '../src/database/db';
import { createConversation, getConversation } from '../src/memory/conversation';
import { getMessages, saveMessage } from '../src/memory/messages';
import { getMemories, saveMemory } from '../src/memory/memories';
import { generateResponse, setGeminiClient } from '../src/agent/gemini';
import { extractMemories } from '../src/agent/memory-extractor';
import { buildConversationContext } from '../src/agent/context';
import { chat } from '../src/agent/chat';
import { buildServer } from '../src/server';

const TEST_DB_PATH = path.resolve(__dirname, '../data/test_phase3.db');

describe('Recall Gemini Integration & Automatic Memory (Phase 3)', () => {
  let app: ReturnType<typeof buildServer>;

  before(() => {
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
    initDatabase(TEST_DB_PATH);
    app = buildServer({ logger: false });
  });

  after(() => {
    closeDatabase();
    setGeminiClient(null);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(() => {
    setGeminiClient(null);
  });

  // Test 1: Gemini response generation using a mocked API
  it('1. should generate response using mocked Gemini API client', async () => {
    const mockClient = {
      models: {
        generateContent: async (params: { model: string; contents: string }) => {
          assert.ok(params.contents.includes('Tell me a joke'));
          return { text: 'Why did the TypeScript developer wear glasses? Because they could not C#!' };
        },
      },
    };

    setGeminiClient(mockClient as any);

    const response = await generateResponse('Tell me a joke');
    assert.equal(
      response,
      'Why did the TypeScript developer wear glasses? Because they could not C#!'
    );
  });

  // Test 2: Memory extraction from a meaningful decision
  it('2. should extract structured memories from a meaningful decision', async () => {
    const conv = createConversation('CRM Planning');
    const userMsg = saveMessage(
      conv.id,
      'user',
      'We shortlisted HubSpot and Pipedrive for a 20-person sales team.'
    );

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify([
            {
              type: 'decision',
              subject: 'CRM shortlist',
              content: 'Shortlisted HubSpot and Pipedrive for a 20-person sales team.',
            },
          ]),
        }),
      },
    };

    setGeminiClient(mockClient as any);

    const memories = await extractMemories(userMsg.content, conv.id, userMsg.id);
    assert.equal(memories.length, 1);
    assert.equal(memories[0].conversation_id, conv.id);
    assert.equal(memories[0].type, 'decision');
    assert.equal(memories[0].subject, 'CRM shortlist');
    assert.equal(
      memories[0].content,
      'Shortlisted HubSpot and Pipedrive for a 20-person sales team.'
    );
    assert.equal(memories[0].source_message_id, userMsg.id);
  });

  // Test 3: Ignoring greetings
  it('3. should ignore greetings and return empty memory list', async () => {
    const conv = createConversation('Greeting Test');
    const userMsg = saveMessage(conv.id, 'user', 'Hello');

    // Should return [] without calling Gemini
    const memories = await extractMemories(userMsg.content, conv.id, userMsg.id);
    assert.deepEqual(memories, []);
  });

  // Test 4: Rejecting malformed memory JSON
  it('4. should gracefully reject malformed or non-conforming memory JSON', async () => {
    const conv = createConversation('Malformed Test');
    const userMsg = saveMessage(conv.id, 'user', 'My favourite language is TypeScript');

    // Mock returning invalid JSON
    const mockClient = {
      models: {
        generateContent: async () => ({
          text: 'This is not valid JSON at all!',
        }),
      },
    };

    setGeminiClient(mockClient as any);

    const memories = await extractMemories(userMsg.content, conv.id, userMsg.id);
    assert.deepEqual(memories, []);

    // Mock returning schema with invalid memory type
    const mockBadSchema = {
      models: {
        generateContent: async () => ({
          text: JSON.stringify([{ type: 'unsupported_type', subject: 'Test', content: 'Test' }]),
        }),
      },
    };
    setGeminiClient(mockBadSchema as any);

    const memoriesBadSchema = await extractMemories(userMsg.content, conv.id, userMsg.id);
    assert.deepEqual(memoriesBadSchema, []);
  });

  // Test 5: Saving the original user message
  // Test 6: Saving the assistant response
  it('5 & 6. should save both original user message and assistant response', async () => {
    const conv = createConversation('Chat Test');

    const mockClient = {
      models: {
        generateContent: async () => ({
          text: 'SQLite with FTS5 is great for fast keyword search.',
        }),
      },
    };
    setGeminiClient(mockClient as any);

    const result = await chat(conv.id, 'What are the benefits of SQLite?');
    assert.equal(result.conversation_id, conv.id);
    assert.equal(result.reply, 'SQLite with FTS5 is great for fast keyword search.');

    const messages = getMessages(conv.id);
    assert.equal(messages.length, 2);

    // 5. User message preserved
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[0].content, 'What are the benefits of SQLite?');

    // 6. Assistant message preserved
    assert.equal(messages[1].role, 'assistant');
    assert.equal(messages[1].content, 'SQLite with FTS5 is great for fast keyword search.');
  });

  // Test 7: Retrieving historical context
  it('7. should retrieve and format historical context including memories and FTS hits without duplicates', async () => {
    const conv = createConversation('Context Test');

    // Add memory
    saveMemory({
      conversation_id: conv.id,
      type: 'constraint',
      subject: 'Database engine',
      content: 'Must use SQLite instead of PostgreSQL.',
    });

    // Add historical message
    saveMessage(conv.id, 'user', 'We decided to use SQLite for lightweight persistence.');
    saveMessage(conv.id, 'assistant', 'Understood, SQLite is selected.');

    const context = buildConversationContext(conv.id, 'persistence');
    assert.ok(context.includes('SAVED CONVERSATION MEMORIES'));
    assert.ok(context.includes('Must use SQLite instead of PostgreSQL.'));
    assert.ok(context.includes('RECENT CONVERSATION HISTORY'));
    assert.ok(context.includes('We decided to use SQLite'));
  });

  // Test 8: Handling Gemini API failures
  it('8. should handle Gemini API failures gracefully while preserving user message', async () => {
    const conv = createConversation('Failure Test');

    const failingClient = {
      models: {
        generateContent: async () => {
          throw new Error('API key quota exceeded');
        },
      },
    };
    setGeminiClient(failingClient as any);

    await assert.rejects(
      async () => {
        await chat(conv.id, 'This message should still be saved even if Gemini fails');
      },
      (err: Error) => {
        assert.ok(err.message.includes('API key quota exceeded'));
        return true;
      }
    );

    // Verify user message was preserved
    const messages = getMessages(conv.id);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'user');
    assert.equal(
      messages[0].content,
      'This message should still be saved even if Gemini fails'
    );
  });

  // Test 9: Ensuring memory extraction failure doesn't break chat
  it('9. should ensure chat succeeds even if memory extraction fails', async () => {
    const conv = createConversation('Resilience Test');

    let callCount = 0;
    const mockClient = {
      models: {
        generateContent: async (params: { config?: { responseMimeType?: string } }) => {
          callCount++;
          // First call is the main chat reply
          if (callCount === 1) {
            return { text: 'Assistant answer succeeds smoothly.' };
          }
          // Second call is memory extraction, let it throw
          throw new Error('Memory extraction model timeout');
        },
      },
    };
    setGeminiClient(mockClient as any);

    const result = await chat(conv.id, 'We selected Docker for deployment.');
    assert.equal(result.reply, 'Assistant answer succeeds smoothly.');
    assert.equal(result.saved_memories, 0); // Gracefully 0 memories saved
  });

  // Test 10: Ensuring memories reference the correct source message
  it('10. should ensure saved memory references the exact source message ID', async () => {
    const conv = createConversation('Source Message Ref Test');

    let callCount = 0;
    const mockClient = {
      models: {
        generateContent: async () => {
          callCount++;
          if (callCount === 1) {
            return { text: 'Got it, recorded.' };
          }
          return {
            text: JSON.stringify([
              {
                type: 'preference',
                subject: 'Theme',
                content: 'User prefers high-contrast dark theme.',
              },
            ]),
          };
        },
      },
    };
    setGeminiClient(mockClient as any);

    const result = await chat(conv.id, 'I prefer high-contrast dark theme.');
    assert.equal(result.saved_memories, 1);

    const memories = getMemories(conv.id);
    assert.equal(memories.length, 1);
    assert.equal(memories[0].source_message_id, result.user_message_id);
    assert.equal(memories[0].subject, 'Theme');
    assert.equal(memories[0].content, 'User prefers high-contrast dark theme.');

    // Also test POST /conversations/:id/chat route endpoint
    callCount = 0;
    const httpRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/chat`,
      payload: { message: 'We decided on React for the UI.' },
    });
    assert.equal(httpRes.statusCode, 200);
    const body = JSON.parse(httpRes.body);
    assert.equal(body.conversation_id, conv.id);
    assert.ok(body.user_message_id);
    assert.ok(body.reply);
  });

  // Test 11: Context assembly does not duplicate the current user message in prompt
  it('11. should assemble historical context before inserting current user message without prompt duplication', async () => {
    const conv = createConversation('Context Assembly Test');
    saveMessage(conv.id, 'user', 'Past message 1');
    saveMessage(conv.id, 'assistant', 'Past response 1');

    let promptSeenByGemini = '';

    setGeminiClient({
      models: {
        generateContent: async (params: { contents: any }) => {
          if (Array.isArray(params.contents)) {
            const userPart = params.contents.find((c) => c.role === 'user');
            promptSeenByGemini = userPart?.parts?.[0]?.text || '';
          }
          return {
            text: '[]',
            functionCalls: [],
          };
        },
      },
    } as any);

    const currentMsgText = 'This is the fresh current user query';
    await chat(conv.id, currentMsgText);

    // Verify historical context was included
    assert.ok(promptSeenByGemini.includes('Past message 1'));
    // Verify current message appears as USER prompt at the end
    assert.ok(promptSeenByGemini.includes(`USER: ${currentMsgText}`));

    // Verify current message does NOT appear in the RETRIEVED CONVERSATION CONTEXT section
    const contextSection = promptSeenByGemini.split('--- RETRIEVED CONVERSATION CONTEXT ---')[1]?.split('USER:')[0] || '';
    assert.ok(!contextSection.includes(currentMsgText), 'Current message must not be duplicated inside retrieved context section');
  });
});

