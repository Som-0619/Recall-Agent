import { tavily } from '@tavily/core';
import { env } from '../config/env';

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  published_at: string | null;
  domain: string;
  retrieved_at: string;
  citation_number?: number;
}

// Module-level client holder to support mocking in tests
let clientInstance: any = null;

/**
 * Checks whether Tavily API credentials are configured.
 */
export function isTavilyConfigured(): boolean {
  return Boolean(env.TAVILY_API_KEY && env.TAVILY_API_KEY.trim().length > 0);
}

/**
 * Validates that the Tavily API key is set, throwing an actionable error if missing.
 */
export function validateTavilyKey(): void {
  if (!isTavilyConfigured()) {
    throw new Error(
      'Tavily API key is not configured. Set TAVILY_API_KEY in your .env file to enable web search.'
    );
  }
}

function getClient(): any {
  if (!clientInstance) {
    validateTavilyKey();
    clientInstance = tavily({ apiKey: env.TAVILY_API_KEY });
  }
  return clientInstance;
}

/**
 * Injects a custom or mock Tavily client for testing.
 */
export function setTavilyClient(client: any): void {
  clientInstance = client;
}

/**
 * Extracts and normalizes the domain from a URL.
 */
export function extractDomain(urlString: string): string {
  try {
    const parsed = new URL(urlString);
    return parsed.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Checks if a string is a valid HTTP or HTTPS URL.
 */
export function isValidHttpUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Searches the web using Tavily Search API.
 * Returns up to 5 filtered, structured search results without duplicate URLs.
 */
export async function searchWeb(query: string): Promise<SearchResult[]> {
  const trimmedQuery = typeof query === 'string' ? query.trim() : '';
  if (!trimmedQuery) {
    return [];
  }

  const client = getClient();
  const now = new Date().toISOString();

  try {
    const response = await client.search(trimmedQuery, {
      maxResults: 5,
      searchDepth: 'basic',
    });

    const rawResults = response?.results || [];
    const seenUrls = new Set<string>();
    const filteredResults: SearchResult[] = [];

    for (const item of rawResults) {
      if (!item || !item.url || typeof item.url !== 'string') {
        continue;
      }

      const normalizedUrl = item.url.trim();

      // Filter out invalid URLs
      if (!isValidHttpUrl(normalizedUrl)) {
        continue;
      }

      // Filter out duplicate URLs
      if (seenUrls.has(normalizedUrl)) {
        continue;
      }
      seenUrls.add(normalizedUrl);

      const domain = extractDomain(normalizedUrl);
      const publishedAt = item.publishedDate && typeof item.publishedDate === 'string' && item.publishedDate.trim().length > 0
        ? item.publishedDate.trim()
        : null;

      filteredResults.push({
        title: (item.title || 'Untitled').trim(),
        url: normalizedUrl,
        content: (item.content || '').trim(),
        published_at: publishedAt,
        domain,
        retrieved_at: now,
      });

      if (filteredResults.length >= 5) {
        break;
      }
    }

    return filteredResults;
  } catch (error: any) {
    // Graceful error handling: log warning and return empty array so model can disclose
    console.warn('Tavily search API error:', error?.message || error);
    return [];
  }
}

