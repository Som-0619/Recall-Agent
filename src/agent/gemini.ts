import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env';
import { geminiTools } from './tools';
import { searchWeb, SearchResult } from '../tools/web-search';

// Singleton holder for the Gemini SDK instance
let aiClient: GoogleGenAI | null = null;

/**
 * Checks whether Gemini API credentials are configured.
 */
export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
}

/**
 * Validates that the Gemini API key is set, throwing an actionable error if missing.
 */
export function validateGeminiKey(): void {
  if (!isGeminiConfigured()) {
    throw new Error(
      'Gemini API key is not configured. Set GEMINI_API_KEY in your .env file to enable AI generation.'
    );
  }
}

function getClient(): GoogleGenAI {
  if (!aiClient) {
    validateGeminiKey();
    aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
  }
  return aiClient;
}

/**
 * Allows injecting a mock client for automated testing without real API calls.
 */
export function setGeminiClient(client: GoogleGenAI | null): void {
  aiClient = client;
}

export interface GenerateOptions {
  model?: string;
  responseMimeType?: string;
}

/**
 * Generates simple text from Gemini using the configured model and API key.
 * Used for direct generation (e.g. memory extraction).
 */
export async function generateResponse(
  prompt: string,
  options?: GenerateOptions
): Promise<string> {
  const client = getClient();
  const model = options?.model || env.MODEL_NAME;

  try {
    const config: { responseMimeType?: string } = {};
    if (options?.responseMimeType) {
      config.responseMimeType = options.responseMimeType;
    }

    const response = await client.models.generateContent({
      model,
      contents: prompt,
      ...(options?.responseMimeType ? { config } : {}),
    });

    return response.text ?? '';
  } catch (error: any) {
    const message = error?.message || String(error);

    if (message.includes('Gemini API key is not configured')) {
      throw error;
    }

    if (message.includes('NOT_FOUND') || message.includes('404')) {
      console.error(
        `Gemini API Error: Model "${model}" was not found or is unavailable. You can update MODEL_NAME in .env.`
      );
      throw new Error(
        `Model "${model}" is unavailable. Check or update MODEL_NAME in your environment configuration.`
      );
    }

    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      console.error('Gemini API Error: Invalid or unauthorized GEMINI_API_KEY.');
      throw new Error('Gemini authentication failed. Please check your GEMINI_API_KEY.');
    }

    console.error('Gemini API Error:', message);
    throw new Error(`Failed to generate response from Gemini: ${message}`);
  }
}

export interface GenerateResultWithTools {
  text: string;
  sources: SearchResult[];
}

export const MAX_SEARCH_CALLS = 3;
export const MAX_MODEL_TURNS = 5;

/**
 * Generates a response with native Gemini tool calling (web_search).
 * Implements a bounded loop (max 3 actual Tavily searches, max 5 model turns,
 * stable sequential global citation numbering across multiple searches).
 */
export async function generateResponseWithTools(
  prompt: string
): Promise<GenerateResultWithTools> {
  const client = getClient();
  const model = env.MODEL_NAME;

  let searchCallCount = 0;
  let modelTurns = 0;
  let nextCitationNumber = 0;
  const seenQueries = new Set<string>();
  const urlToCitationIndex = new Map<string, number>();
  const collectedSources: SearchResult[] = [];

  const contents: any[] = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  try {
    // Bounded tool execution loop (bounded by both MAX_MODEL_TURNS and MAX_SEARCH_CALLS)
    while (modelTurns < MAX_MODEL_TURNS) {
      modelTurns++;

      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          tools: geminiTools,
        },
      });

      const functionCalls = response.functionCalls || [];

      // If no function call requested, Gemini delivered its final response
      if (functionCalls.length === 0) {
        return {
          text: response.text ?? '',
          sources: collectedSources,
        };
      }

      // If maximum model turns reached with pending tool calls, return safe final response
      if (modelTurns >= MAX_MODEL_TURNS) {
        const safeText =
          response.text?.trim() ||
          'I have reached the maximum number of model execution turns for this inquiry. Based on available research, here is what was found.';
        return {
          text: safeText,
          sources: collectedSources,
        };
      }

      // Add the model's turn to conversation history
      const candidateContent = response.candidates?.[0]?.content;
      if (candidateContent) {
        contents.push(candidateContent);
      }

      // Process each function call requested by the model
      for (const call of functionCalls) {
        // Enforce tool name safety
        if (call.name !== 'web_search') {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: call.name,
                  response: {
                    error: `Unsupported tool '${call.name}'. Only 'web_search' is allowed.`,
                  },
                },
              },
            ],
          });
          continue;
        }

        // Validate query argument
        const queryArg = call.args?.query;
        if (!queryArg || typeof queryArg !== 'string' || !queryArg.trim()) {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'web_search',
                  response: {
                    error: 'Invalid search query. Query must be a non-empty string.',
                  },
                },
              },
            ],
          });
          continue;
        }

        const normalizedQuery = queryArg.trim().toLowerCase();

        // Enforce: do not execute the same normalized query twice in one turn
        if (seenQueries.has(normalizedQuery)) {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'web_search',
                  response: {
                    warning: `Duplicate query '${queryArg}'. Results were already provided in this conversation turn.`,
                  },
                },
              },
            ],
          });
          continue;
        }

        // Enforce: maximum 3 search calls per user message
        if (searchCallCount >= MAX_SEARCH_CALLS) {
          contents.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name: 'web_search',
                  response: {
                    warning:
                      'Web search limit (3 calls) reached for this turn. Please synthesize your final response using available information.',
                  },
                },
              },
            ],
          });
          continue;
        }

        // Execute web search
        seenQueries.add(normalizedQuery);
        searchCallCount++;

        const results = await searchWeb(queryArg.trim());

        // Assign stable, sequential global citation numbers to unique sources across multiple searches
        const toolResultsForGemini = results.map((res) => {
          let citationNum = urlToCitationIndex.get(res.url);
          if (!citationNum) {
            nextCitationNumber++;
            citationNum = nextCitationNumber;
            urlToCitationIndex.set(res.url, citationNum);
            collectedSources.push({
              ...res,
              citation_number: citationNum,
            });
          }
          return {
            citation: `[${citationNum}]`,
            citation_number: citationNum,
            title: res.title,
            url: res.url,
            content: res.content,
            published_at: res.published_at,
            domain: res.domain,
          };
        });

        // Return tool response to Gemini with explicit citation indices
        contents.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: 'web_search',
                response: {
                  query: queryArg.trim(),
                  results:
                    toolResultsForGemini.length > 0
                      ? toolResultsForGemini
                      : 'No relevant search results found.',
                },
              },
            },
          ],
        });
      }
    }

    // Safety fallback if loop exits
    return {
      text: 'I have reached the maximum number of model execution turns for this inquiry. Based on available research, here is what was found.',
      sources: collectedSources,
    };
  } catch (error: any) {
    const message = error?.message || String(error);

    if (message.includes('Gemini API key is not configured')) {
      throw error;
    }

    if (message.includes('NOT_FOUND') || message.includes('404')) {
      throw new Error(
        `Model "${model}" is unavailable. Check or update MODEL_NAME in your environment configuration.`
      );
    }

    if (
      message.includes('API_KEY_INVALID') ||
      message.includes('401') ||
      message.includes('403')
    ) {
      throw new Error('Gemini authentication failed. Please check your GEMINI_API_KEY.');
    }

    console.error('Gemini generateContent error:', message);
    throw new Error(`Failed to generate response from Gemini: ${message}`);
  }
}
