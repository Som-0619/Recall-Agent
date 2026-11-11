import crypto from 'crypto';
import { initDatabase, closeDatabase, getDb } from '../database/db';
import { buildConversationContext } from '../agent/context';
import { chat, ChatResult } from '../agent/chat';
import { setGeminiClient } from '../agent/gemini';
import { setTavilyClient } from '../tools/web-search';
import { evaluationDataset, EvaluationCase } from './dataset';
import { CaseExecutionResult, calculateMetrics, MetricSummary } from './metrics';

export interface EvaluationRunReport {
  timestamp: string;
  summary: MetricSummary;
  results: CaseExecutionResult[];
}

/**
 * Runs the evaluation suite against the specified dataset cases.
 */
export async function runEvaluation(
  customDataset: EvaluationCase[] = evaluationDataset
): Promise<EvaluationRunReport> {
  const results: CaseExecutionResult[] = [];

  for (const testCase of customDataset) {
    // 1. Initialize isolated in-memory database for each test case
    initDatabase(':memory:');
    const db = getDb();
    const now = new Date().toISOString();

    const createdConvIds: string[] = [];

    // 2. Seed historical setup conversations, messages, and memories
    for (const convSetup of testCase.setupConversations) {
      const convId = convSetup.id || crypto.randomUUID();
      createdConvIds.push(convId);
      const convTime = convSetup.createdAt || now;

      db.prepare(`
        INSERT INTO conversations (id, title, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(convId, convSetup.title, convTime, convTime);

      for (const msg of convSetup.messages) {
        const msgId = crypto.randomUUID();
        const msgTime = msg.createdAt || now;
        db.prepare(`
          INSERT INTO messages (id, conversation_id, role, content, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(msgId, convId, msg.role, msg.content, msgTime);
      }

      for (const mem of convSetup.memories || []) {
        const memId = crypto.randomUUID();
        const memTime = mem.createdAt || now;
        db.prepare(`
          INSERT INTO memories (id, conversation_id, type, subject, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(memId, convId, mem.type, mem.subject, mem.content, memTime);
      }
    }

    const activeConvId = createdConvIds[testCase.activeConversationIndex];

    // 3. Configure mocked Tavily client if provided
    let searchCallsMade = 0;
    if (testCase.mockTavilyResponse) {
      setTavilyClient({
        search: async (query: string) => {
          searchCallsMade++;
          const res = testCase.mockTavilyResponse!(query);
          return { query, results: res };
        },
      });
    } else {
      setTavilyClient({
        search: async () => {
          searchCallsMade++;
          return { results: [] };
        },
      });
    }

    // 4. Configure mocked Gemini client
    let geminiTurn = 0;
    let geminiCalledWithTools = false;

    if (testCase.mockGeminiResponse) {
      setGeminiClient({
        models: {
          generateContent: async (params: any) => {
            // Intercept memory extraction calls to return valid JSON
            if (params.contents && typeof params.contents === 'string' && params.contents.includes('memory extraction')) {
              return {
                text: JSON.stringify(
                  testCase.expected.expectedMemoryTypes
                    ? [{ type: testCase.expected.expectedMemoryTypes[0], subject: 'Fact', content: testCase.userMessage }]
                    : []
                ),
                functionCalls: [],
              };
            }

            geminiTurn++;
            if (params.config?.tools) {
              geminiCalledWithTools = true;
            }
            const res = testCase.mockGeminiResponse!(geminiTurn, testCase.userMessage, searchCallsMade > 0);
            return {
              text: res.text,
              functionCalls: res.functionCalls || [],
              candidates: res.functionCalls && res.functionCalls.length > 0 ? [
                {
                  content: {
                    role: 'model',
                    parts: res.functionCalls.map((fc) => ({ functionCall: fc })),
                  },
                },
              ] : [],
            };
          },
        },
      } as any);
    } else {
      setGeminiClient(null);
    }

    const startTime = performance.now();
    let reply = '';
    let sources: Array<{ title: string; url: string; domain: string }> = [];
    let savedMemories = 0;
    let error: string | undefined;
    const notes: string[] = [];

    // Capture retrieved context for evaluation analysis
    const retrievedContext = buildConversationContext(activeConvId, testCase.userMessage);

    try {
      const chatResult: ChatResult = await chat(activeConvId, testCase.userMessage);
      reply = chatResult.reply;
      sources = chatResult.sources.map((s) => ({ title: s.title, url: s.url, domain: s.domain }));
      savedMemories = chatResult.saved_memories;
    } catch (err: any) {
      error = err.message || String(err);
    }

    const latencyMs = Math.round(performance.now() - startTime);

    // 5. Evaluate individual metrics
    let retrievalAccurate = true;
    if (testCase.expected.expectedKeywords.length > 0) {
      // Check if context contains expected keywords
      const contextLower = retrievedContext.toLowerCase();
      retrievalAccurate = testCase.expected.expectedKeywords.some((kw) =>
        contextLower.includes(kw.toLowerCase())
      );
      if (!retrievalAccurate) {
        notes.push('Context did not retrieve expected keywords.');
      }
    }

    let answerCorrect = true;
    if (testCase.expected.expectFailure) {
      answerCorrect = !!error;
    } else if (error) {
      answerCorrect = false;
      notes.push(`Unexpected error: ${error}`);
    } else {
      const replyLower = reply.toLowerCase();
      // Must contain expected keywords
      for (const kw of testCase.expected.expectedKeywords) {
        if (!replyLower.includes(kw.toLowerCase())) {
          answerCorrect = false;
          notes.push(`Answer missing expected keyword: "${kw}"`);
        }
      }
      // Must not contain forbidden keywords
      for (const fkw of testCase.expected.forbiddenKeywords || []) {
        if (replyLower.includes(fkw.toLowerCase())) {
          answerCorrect = false;
          notes.push(`Answer contains forbidden keyword: "${fkw}"`);
        }
      }
    }

    let dateAccurate = true;
    if (testCase.category === 'date_recall') {
      dateAccurate = answerCorrect && retrievalAccurate;
      if (!dateAccurate) {
        notes.push('Date-specific recall failed to isolate matching date.');
      }
    }

    let citationsCorrect = true;
    if (testCase.expected.shouldContainCitations) {
      const hasCitationBrackets = /\[\d+\]/.test(reply);
      const hasSources = sources.length > 0;
      citationsCorrect = hasCitationBrackets && hasSources;
      if (!citationsCorrect) {
        notes.push('Missing bracket citations [1] or missing sources metadata.');
      }
    }

    let searchDecisionAccurate = true;
    if (testCase.expected.searchRequired) {
      searchDecisionAccurate = searchCallsMade > 0;
      if (!searchDecisionAccurate) {
        notes.push('Search was required but not executed.');
      }
    } else {
      searchDecisionAccurate = searchCallsMade === 0;
      if (!searchDecisionAccurate) {
        notes.push('Search was executed unnecessarily.');
      }
    }

    // Determine overall pass status for this case
    const passed =
      (testCase.expected.expectFailure ? !!error : !error) &&
      answerCorrect &&
      searchDecisionAccurate &&
      citationsCorrect;

    results.push({
      caseId: testCase.id,
      category: testCase.category,
      name: testCase.name,
      passed,
      retrievedContext,
      reply,
      sources,
      savedMemories,
      searchCallsMade,
      latencyMs,
      error,
      scores: {
        retrievalAccurate,
        answerCorrect,
        dateAccurate,
        citationsCorrect,
        searchDecisionAccurate,
      },
      notes,
    });

    closeDatabase();
  }

  // Reset clients
  setGeminiClient(null);
  setTavilyClient(null);

  const summary = calculateMetrics(results, customDataset);

  return {
    timestamp: new Date().toISOString(),
    summary,
    results,
  };
}
