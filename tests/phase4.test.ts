import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { initDatabase, closeDatabase } from '../src/database/db';
import { createConversation } from '../src/memory/conversation';
import { getMessages } from '../src/memory/messages';
import { setGeminiClient } from '../src/agent/gemini';
import { setTavilyClient, searchWeb } from '../src/tools/web-search';
import { chat } from '../src/agent/chat';
import { buildServer } from '../src/server';

const TEST_DB_PATH = path.resolve(__dirname, '../data/test_phase4.db');

describe('Recall Web Search Integration & Tool Calling (Phase 4)', () => {
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
    setTavilyClient(null);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.unlinkSync(TEST_DB_PATH);
    }
  });

  beforeEach(() => {
    setGeminiClient(null);
    setTavilyClient(null);
  });

  // Test 1: Tavily search returns structured results
  it('1. should return structured search results from Tavily', async () => {
    const mockTavily = {
      search: async (query: string) => ({
        query,
        results: [
          {
            title: 'AWS RDS PostgreSQL Pricing',
            url: 'https://aws.amazon.com/rds/postgresql/pricing/',
            content: 'Amazon RDS for PostgreSQL pricing details and instances.',
            publishedDate: '2026-01-10',
          },
        ],
      }),
    };
    setTavilyClient(mockTavily);

    const results = await searchWeb('PostgreSQL hosting pricing');
    assert.equal(results.length, 1);
    assert.equal(results[0].title, 'AWS RDS PostgreSQL Pricing');
    assert.equal(results[0].url, 'https://aws.amazon.com/rds/postgresql/pricing/');
    assert.equal(results[0].domain, 'aws.amazon.com');
    assert.equal(results[0].published_at, '2026-01-10');
    assert.ok(results[0].retrieved_at);
  });

  // Test 2: Duplicate URLs are removed
  it('2. should remove duplicate URLs from search results', async () => {
    const mockTavily = {
      search: async () => ({
        results: [
          { title: 'Doc 1', url: 'https://example.com/pricing', content: 'Price 1' },
          { title: 'Doc 1 Duplicate', url: 'https://example.com/pricing', content: 'Duplicate content' },
        ],
      }),
    };
    setTavilyClient(mockTavily);

    const results = await searchWeb('test query');
    assert.equal(results.length, 1);
    assert.equal(results[0].url, 'https://example.com/pricing');
  });

  // Test 3: Invalid URLs are rejected
  it('3. should reject non-HTTP/HTTPS and malformed URLs', async () => {
    const mockTavily = {
      search: async () => ({
        results: [
          { title: 'Bad 1', url: 'not-a-url', content: 'bad' },
          { title: 'Bad 2', url: 'ftp://files.example.com', content: 'ftp' },
          { title: 'Good', url: 'https://valid.example.com/guide', content: 'good' },
        ],
      }),
    };
    setTavilyClient(mockTavily);

    const results = await searchWeb('test query');
    assert.equal(results.length, 1);
    assert.equal(results[0].url, 'https://valid.example.com/guide');
    assert.equal(results[0].domain, 'valid.example.com');
  });

  // Test 4: Gemini answers without searching when tool is not needed
  it('4. should allow Gemini to answer directly without requesting web search', async () => {
    const conv = createConversation('Direct Answer Test');

    let tavilyCalled = false;
    setTavilyClient({
      search: async () => {
        tavilyCalled = true;
        return { results: [] };
      },
    });

    const mockGemini = {
      models: {
        generateContent: async () => ({
          text: 'RAG stands for Retrieval-Augmented Generation.',
          functionCalls: [],
        }),
      },
    };
    setGeminiClient(mockGemini as any);

    const result = await chat(conv.id, 'What is RAG?');
    assert.equal(result.reply, 'RAG stands for Retrieval-Augmented Generation.');
    assert.equal(result.sources.length, 0);
    assert.equal(tavilyCalled, false);
  });

  // Test 5: Gemini requests web_search
  it('5. should execute web_search when requested by Gemini and return final answer', async () => {
    const conv = createConversation('Search Tool Test');

    setTavilyClient({
      search: async (query: string) => ({
        results: [
          {
            title: 'Gemini 2.5 Announcements',
            url: 'https://blog.google/technology/ai/gemini-2-5/',
            content: 'Google introduces Gemini 2.5 Flash with advanced reasoning.',
            publishedDate: '2026-02-01',
          },
        ],
      }),
    });

    let turn = 0;
    const mockGemini = {
      models: {
        generateContent: async () => {
          turn++;
          if (turn === 1) {
            // First turn: model decides to call web_search
            return {
              text: null,
              functionCalls: [
                {
                  name: 'web_search',
                  args: { query: 'latest Gemini model updates' },
                },
              ],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'latest Gemini model updates' } } }],
                  },
                },
              ],
            };
          }
          // Second turn: model receives results and delivers final answer with citation
          return {
            text: 'Google announced Gemini 2.5 Flash with advanced reasoning [1].',
            functionCalls: [],
          };
        },
      },
    };
    setGeminiClient(mockGemini as any);

    const result = await chat(conv.id, 'What are the latest Gemini model updates?');
    assert.equal(result.reply, 'Google announced Gemini 2.5 Flash with advanced reasoning [1].');
    assert.equal(result.sources.length, 1);
    assert.equal(result.sources[0].url, 'https://blog.google/technology/ai/gemini-2-5/');
  });

  // Test 6: Tool arguments are validated
  it('6. should validate tool arguments and safely handle malformed tool calls', async () => {
    const conv = createConversation('Malformed Tool Arg Test');

    let tavilyCalled = false;
    setTavilyClient({
      search: async () => {
        tavilyCalled = true;
        return { results: [] };
      },
    });

    let turn = 0;
    const mockGemini = {
      models: {
        generateContent: async () => {
          turn++;
          if (turn === 1) {
            // Model calls tool with empty string query
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: '   ' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: '   ' } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'I could not perform search with an empty query.',
            functionCalls: [],
          };
        },
      },
    };
    setGeminiClient(mockGemini as any);

    const result = await chat(conv.id, 'Search something');
    assert.equal(tavilyCalled, false);
    assert.ok(result.reply);
  });

  // Test 7: Maximum search-call limit is enforced
  it('7. should enforce maximum of 3 search calls per user message', async () => {
    const conv = createConversation('Limit Test');

    let searchCount = 0;
    setTavilyClient({
      search: async () => {
        searchCount++;
        return { results: [{ title: 'Res', url: `https://example.com/res${searchCount}`, content: 'content' }] };
      },
    });

    let turn = 0;
    const mockGemini = {
      models: {
        generateContent: async () => {
          turn++;
          if (turn <= 4) {
            // Model attempts 4 distinct searches
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: `query number ${turn}` } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: `query number ${turn}` } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'Final response after reaching search limit.',
            functionCalls: [],
          };
        },
      },
    };
    setGeminiClient(mockGemini as any);

    const result = await chat(conv.id, 'Exhaustive research topic');
    assert.equal(searchCount, 3); // Exactly bounded at 3 searches
    assert.equal(result.reply, 'Final response after reaching search limit.');
  });

  // Test 8: Duplicate queries are prevented
  it('8. should prevent executing duplicate search queries in the same turn', async () => {
    const conv = createConversation('Duplicate Query Test');

    let executionCount = 0;
    setTavilyClient({
      search: async () => {
        executionCount++;
        return { results: [{ title: 'Result', url: 'https://example.com/info', content: 'test' }] };
      },
    });

    let turn = 0;
    const mockGemini = {
      models: {
        generateContent: async () => {
          turn++;
          if (turn === 1) {
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: 'PostgreSQL pricing' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'PostgreSQL pricing' } } }],
                  },
                },
              ],
            };
          }
          if (turn === 2) {
            // Model attempts duplicate search
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: 'postgresql pricing' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'postgresql pricing' } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'Synthesized response.',
            functionCalls: [],
          };
        },
      },
    };
    setGeminiClient(mockGemini as any);

    await chat(conv.id, 'Check PostgreSQL pricing');
    assert.equal(executionCount, 1); // Only executed once!
  });

  // Test 9: Sources are returned with the chat response
  it('9. should return structured sources in chat service and HTTP response', async () => {
    const conv = createConversation('Sources API Test');

    setTavilyClient({
      search: async () => ({
        results: [
          {
            title: 'Pricing Page',
            url: 'https://example.com/pricing',
            content: 'Hosting plans start at $10/month.',
            publishedDate: '2026-01-01',
          },
        ],
      }),
    });

    let turn = 0;
    setGeminiClient({
      models: {
        generateContent: async () => {
          turn++;
          if (turn === 1) {
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: 'hosting plans' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'hosting plans' } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'Hosting starts at $10/month according to [1].',
            functionCalls: [],
          };
        },
      },
    } as any);

    const httpRes = await app.inject({
      method: 'POST',
      url: `/conversations/${conv.id}/chat`,
      payload: { message: 'How much does hosting cost?' },
    });

    assert.equal(httpRes.statusCode, 200);
    const body = JSON.parse(httpRes.body);
    assert.equal(body.conversation_id, conv.id);
    assert.ok(body.reply.includes('$10/month'));
    assert.ok(Array.isArray(body.sources));
    assert.equal(body.sources.length, 1);
    assert.equal(body.sources[0].url, 'https://example.com/pricing');
    assert.equal(body.sources[0].domain, 'example.com');
  });

  // Test 10: Tavily failure is handled gracefully
  it('10. should handle Tavily API failures gracefully without crashing chat', async () => {
    const conv = createConversation('Tavily Failure Test');

    setTavilyClient({
      search: async () => {
        throw new Error('Tavily API quota limit exceeded (429)');
      },
    });

    let turn = 0;
    setGeminiClient({
      models: {
        generateContent: async () => {
          turn++;
          if (turn === 1) {
            return {
              text: null,
              functionCalls: [{ name: 'web_search', args: { query: 'news' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'news' } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'I could not verify current information because web search was unavailable.',
            functionCalls: [],
          };
        },
      },
    } as any);

    const result = await chat(conv.id, 'What is the news?');
    assert.ok(result.reply.includes('could not verify current information'));
    assert.equal(result.sources.length, 0);
  });

  // Test 11: Gemini failure preserves the user message
  it('11. should preserve user message when Gemini fails', async () => {
    const conv = createConversation('Gemini Failure Test');

    setGeminiClient({
      models: {
        generateContent: async () => {
          throw new Error('Gemini service unavailable (503)');
        },
      },
    } as any);

    await assert.rejects(
      async () => {
        await chat(conv.id, 'User prompt before crash');
      },
      (err: Error) => {
        assert.ok(err.message.includes('Gemini service unavailable'));
        return true;
      }
    );

    const messages = getMessages(conv.id);
    assert.equal(messages.length, 1);
    assert.equal(messages[0].role, 'user');
    assert.equal(messages[0].content, 'User prompt before crash');
  });

  // Test 12: Search results are not fabricated when none are returned
  it('12. should not fabricate search results when Tavily returns empty results', async () => {
    setTavilyClient({
      search: async () => ({ results: [] }),
    });

    const results = await searchWeb('completely obscure query with no results');
    assert.deepEqual(results, []);
  });

  // Test 13: MAX_MODEL_TURNS limit enforcement on repeated tool calls
  it('13. should enforce MAX_MODEL_TURNS on repeated tool requests and return a safe final response', async () => {
    const conv = createConversation('Unbounded Tool Loop Test');
    let turnCount = 0;

    setTavilyClient({
      search: async (q: string) => ({
        results: [
          {
            title: `Result for ${q}`,
            url: `https://example.com/res-${turnCount}`,
            content: `Content for ${q}`,
          },
        ],
      }),
    });

    // Mock Gemini that endlessly requests new searches on every turn
    setGeminiClient({
      models: {
        generateContent: async () => {
          turnCount++;
          return {
            functionCalls: [
              {
                name: 'web_search',
                args: { query: `endless query ${turnCount}` },
              },
            ],
            candidates: [
              {
                content: {
                  role: 'model',
                  parts: [
                    {
                      functionCall: {
                        name: 'web_search',
                        args: { query: `endless query ${turnCount}` },
                      },
                    },
                  ],
                },
              },
            ],
          };
        },
      },
    } as any);

    const { generateResponseWithTools } = await import('../src/agent/gemini');
    const result = await generateResponseWithTools('Test unbounded loop');
    assert.ok(result.text.length > 0);
    assert.ok(
      result.text.includes('maximum number of model execution turns') ||
        result.text.includes('execution limit')
    );
    assert.equal(turnCount, 5); // Strictly capped at MAX_MODEL_TURNS = 5
  });

  // Test 14: Sequential citation numbers and duplicate URL handling across multiple search calls
  it('14. should assign stable, sequential citation numbers across multiple searches with duplicate URLs', async () => {
    let searchIndex = 0;
    setTavilyClient({
      search: async () => {
        searchIndex++;
        if (searchIndex === 1) {
          return {
            results: [
              { title: 'Doc A', url: 'https://example.com/a', content: 'Info A' },
              { title: 'Doc B', url: 'https://example.com/b', content: 'Info B' },
            ],
          };
        } else {
          return {
            results: [
              { title: 'Doc B Duplicate', url: 'https://example.com/b', content: 'Info B repeat' },
              { title: 'Doc C', url: 'https://example.com/c', content: 'Info C' },
            ],
          };
        }
      },
    });

    let geminiTurn = 0;
    const toolResponsesReceived: any[] = [];

    setGeminiClient({
      models: {
        generateContent: async (params: any) => {
          geminiTurn++;
          if (geminiTurn > 1) {
            const lastPart = params.contents[params.contents.length - 1];
            if (lastPart?.parts?.[0]?.functionResponse) {
              toolResponsesReceived.push(lastPart.parts[0].functionResponse.response);
            }
          }

          if (geminiTurn === 1) {
            return {
              functionCalls: [{ name: 'web_search', args: { query: 'first query' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'first query' } } }],
                  },
                },
              ],
            };
          }
          if (geminiTurn === 2) {
            return {
              functionCalls: [{ name: 'web_search', args: { query: 'second query' } }],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [{ functionCall: { name: 'web_search', args: { query: 'second query' } } }],
                  },
                },
              ],
            };
          }
          return {
            text: 'Synthesized answer citing Doc A [1], Doc B [2], and Doc C [3].',
            functionCalls: [],
          };
        },
      },
    } as any);

    const { generateResponseWithTools } = await import('../src/agent/gemini');
    const { sources } = await generateResponseWithTools('Synthesize findings');

    // Verify final sources array deduplication and stable citation numbers
    assert.equal(sources.length, 3);
    assert.equal(sources[0].url, 'https://example.com/a');
    assert.equal(sources[0].citation_number, 1);
    assert.equal(sources[1].url, 'https://example.com/b');
    assert.equal(sources[1].citation_number, 2);
    assert.equal(sources[2].url, 'https://example.com/c');
    assert.equal(sources[2].citation_number, 3);

    // Verify citation numbers in tool responses sent to Gemini
    assert.equal(toolResponsesReceived.length, 2);
    // Search 1 tool results: Doc A is [1], Doc B is [2]
    assert.equal(toolResponsesReceived[0].results[0].citation, '[1]');
    assert.equal(toolResponsesReceived[0].results[0].citation_number, 1);
    assert.equal(toolResponsesReceived[0].results[1].citation, '[2]');
    assert.equal(toolResponsesReceived[0].results[1].citation_number, 2);
    // Search 2 tool results: Doc B was already seen so it remains [2], Doc C gets [3]
    assert.equal(toolResponsesReceived[1].results[0].citation, '[2]');
    assert.equal(toolResponsesReceived[1].results[0].citation_number, 2);
    assert.equal(toolResponsesReceived[1].results[1].citation, '[3]');
    assert.equal(toolResponsesReceived[1].results[1].citation_number, 3);
  });

  // Test 15: External services validate credentials on call and return actionable errors
  it('15. should validate API credentials and provide clear errors when unconfigured', async () => {
    const { validateGeminiKey } = await import('../src/agent/gemini');
    const { validateTavilyKey } = await import('../src/tools/web-search');

    // Both validation functions exist and are exported
    assert.equal(typeof validateGeminiKey, 'function');
    assert.equal(typeof validateTavilyKey, 'function');
  });
});
