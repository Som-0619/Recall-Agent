import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { initDatabase, closeDatabase } from '../src/database/db';
import {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
  deleteConversation,
} from '../src/memory/conversation';
import {
  saveMessage,
  getMessages,
  getRecentMessages,
  searchMessages,
} from '../src/memory/messages';
import {
  saveMemory,
  getMemories,
  searchMemories,
  deleteMemory,
} from '../src/memory/memories';
import { buildServer } from '../src/server';

const TEST_DB_PATH = path.resolve(__dirname, '../data/test_memory.db');

describe('Recall Memory & Database System (Phase 2)', () => {
  let app: ReturnType<typeof buildServer>;

  before(() => {
    // Clean up any stale test database
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }

    // Initialize clean temporary database for testing
    initDatabase(TEST_DB_PATH);
    app = buildServer({ logger: false });
  });

  after(() => {
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  // Test 1: Creating a conversation
  it('1. should create and retrieve a conversation', async () => {
    const conv = createConversation('AI Research Project');
    assert.ok(conv.id);
    assert.equal(conv.title, 'AI Research Project');
    assert.ok(conv.created_at);
    assert.ok(conv.updated_at);

    const fetched = getConversation(conv.id);
    assert.ok(fetched);
    assert.equal(fetched.id, conv.id);
    assert.equal(fetched.title, 'AI Research Project');

    // Test API route
    const response = await app.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: 'Web Search Chat' },
    });
    assert.equal(response.statusCode, 201);
    const body = JSON.parse(response.body);
    assert.equal(body.title, 'Web Search Chat');
  });

  // Test 2: Saving and retrieving messages
  it('2. should save and retrieve messages in chronological order', async () => {
    const conv = createConversation('Chat Session');

    const msg1 = saveMessage(conv.id, 'user', 'What is Fastify?');
    const msg2 = saveMessage(conv.id, 'assistant', 'Fastify is a fast web framework for Node.js.');
    const msg3 = saveMessage(conv.id, 'user', 'Does it support TypeScript?');

    assert.equal(msg1.role, 'user');
    assert.equal(msg2.role, 'assistant');

    const allMessages = getMessages(conv.id);
    assert.equal(allMessages.length, 3);
    assert.equal(allMessages[0].content, 'What is Fastify?');
    assert.equal(allMessages[1].content, 'Fastify is a fast web framework for Node.js.');
    assert.equal(allMessages[2].content, 'Does it support TypeScript?');

    // Test getRecentMessages limit
    const recent = getRecentMessages(conv.id, 2);
    assert.equal(recent.length, 2);
    assert.equal(recent[0].content, 'Fastify is a fast web framework for Node.js.');
    assert.equal(recent[1].content, 'Does it support TypeScript?');

    // Test API endpoint
    const apiRes = await app.inject({
      method: 'GET',
      url: `/conversations/${conv.id}/messages?limit=2`,
    });
    assert.equal(apiRes.statusCode, 200);
    const apiBody = JSON.parse(apiRes.body);
    assert.equal(apiBody.length, 2);
  });

  // Test 3: Searching for a previous message using FTS5
  it('3. should search for previous messages using FTS5 full-text search', async () => {
    const conv = createConversation('Research on Quantum');

    saveMessage(conv.id, 'user', 'Tell me about quantum entanglement in physics.');
    saveMessage(conv.id, 'assistant', 'Quantum entanglement is a phenomenon where particles share quantum states.');
    saveMessage(conv.id, 'user', 'Can we use this in quantum computing?');

    const results = searchMessages('entanglement');
    assert.ok(results.length >= 1);
    assert.equal(results[0].conversation_id, conv.id);
    assert.ok(results[0].content.includes('entanglement'));
    assert.ok(results[0].id);
    assert.ok(results[0].created_at);

    // Test API search route
    const searchRes = await app.inject({
      method: 'GET',
      url: '/search?q=computing',
    });
    assert.equal(searchRes.statusCode, 200);
    const searchBody = JSON.parse(searchRes.body);
    assert.ok(searchBody.length >= 1);
    assert.ok(searchBody.some((m: { content: string }) => m.content.includes('quantum computing')));
  });

  // Test 4: Saving and retrieving memories
  it('4. should save and retrieve structured memories', async () => {
    const conv = createConversation('Preferences Discussion');
    const msg = saveMessage(conv.id, 'user', 'I strongly prefer dark mode and TypeScript.');

    const memory = saveMemory({
      conversation_id: conv.id,
      type: 'preference',
      subject: 'UI & Language Preference',
      content: 'User prefers dark mode UI and TypeScript programming.',
      source_message_id: msg.id,
    });

    assert.ok(memory.id);
    assert.equal(memory.type, 'preference');
    assert.equal(memory.source_message_id, msg.id);

    const memories = getMemories(conv.id);
    assert.equal(memories.length, 1);
    assert.equal(memories[0].subject, 'UI & Language Preference');

    // Search memories
    const foundMemories = searchMemories('dark mode');
    assert.equal(foundMemories.length, 1);
    assert.equal(foundMemories[0].id, memory.id);

    // Test API route
    const memRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/memories`,
      payload: {
        type: 'decision',
        subject: 'Architecture',
        content: 'Decided to use SQLite with FTS5.',
        source_message_id: msg.id,
      },
    });
    assert.equal(memRes.statusCode, 201);
    const memBody = JSON.parse(memRes.body);
    assert.equal(memBody.type, 'decision');

    const listRes = await app.inject({
      method: 'GET',
      url: `/conversations/${conv.id}/memories`,
    });
    assert.equal(listRes.statusCode, 200);
    assert.equal(JSON.parse(listRes.body).length, 2);
  });

  // Test 5: Deleting a conversation and its related records
  it('5. should delete a conversation and cascade delete its messages and memories', async () => {
    const conv = createConversation('Temporary Conversation');
    saveMessage(conv.id, 'user', 'Ephemeral message about temporary topic');
    saveMemory({
      conversation_id: conv.id,
      type: 'fact',
      subject: 'Temp fact',
      content: 'Will be deleted',
    });

    assert.equal(getMessages(conv.id).length, 1);
    assert.equal(getMemories(conv.id).length, 1);

    const deleted = deleteConversation(conv.id);
    assert.equal(deleted, true);

    // Conversation should no longer exist
    assert.equal(getConversation(conv.id), null);
    // Messages and memories should have cascaded
    assert.equal(getMessages(conv.id).length, 0);
    assert.equal(getMemories(conv.id).length, 0);

    // FTS search should also have cleaned up
    const searchRes = searchMessages('Ephemeral');
    assert.equal(searchRes.length, 0);
  });

  // Test 6: Searching with an empty query
  it('6. should safely handle empty search queries', async () => {
    assert.deepEqual(searchMessages(''), []);
    assert.deepEqual(searchMessages('   '), []);

    const searchRes = await app.inject({
      method: 'GET',
      url: '/search?q=',
    });
    assert.equal(searchRes.statusCode, 200);
    assert.deepEqual(JSON.parse(searchRes.body), []);
  });

  // Test 7: Retrieving a nonexistent conversation
  it('7. should handle nonexistent conversations with 404', async () => {
    assert.equal(getConversation('nonexistent-uuid'), null);

    const res = await app.inject({
      method: 'GET',
      url: '/conversations/nonexistent-uuid',
    });
    assert.equal(res.statusCode, 404);
    assert.deepEqual(JSON.parse(res.body), { error: 'Conversation not found' });

    // Also when trying to post a message or memory to nonexistent conversation
    const msgRes = await app.inject({
      method: 'POST',
      url: '/conversations/nonexistent-uuid/messages',
      payload: { role: 'user', content: 'Hello?' },
    });
    assert.equal(msgRes.statusCode, 404);

    const memRes = await app.inject({
      method: 'POST',
      url: '/conversations/nonexistent-uuid/memories',
      payload: { type: 'fact', subject: 'test', content: 'test' },
    });
    assert.equal(memRes.statusCode, 404);
  });

  // Test 8: Preventing invalid roles and malformed requests
  it('8. should reject invalid roles and malformed requests with 400', async () => {
    const conv = createConversation('Validation Test');

    // Malformed conversation title (empty)
    const badConvRes = await app.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: '' },
    });
    assert.equal(badConvRes.statusCode, 400);

    // Invalid role
    const badRoleRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/messages`,
      payload: { role: 'admin', content: 'Not allowed' },
    });
    assert.equal(badRoleRes.statusCode, 400);

    // Empty content
    const badContentRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/messages`,
      payload: { role: 'user', content: '' },
    });
    assert.equal(badContentRes.statusCode, 400);

    // Invalid memory type
    const badTypeRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/memories`,
      payload: { type: 'opinion', subject: 'Subject', content: 'Content' },
    });
    assert.equal(badTypeRes.statusCode, 400);
  });
});

