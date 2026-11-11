# Recall Agent — Technical Interview Guide

This guide is designed for engineering interviews and architectural walkthroughs. It covers all 14 core questions about Recall's architecture, trade-offs, algorithms, failure modes, and implementation details.

For each question, both a **Simple Explanation** (soundbite / high-level concept) and a **Technical Explanation** (code-level specifics, database queries, and architectural trade-offs) are provided, along with common interviewer follow-ups.

---

## Table of Contents
1. [What is Recall?](#1-what-is-recall)
2. [What problem does it solve?](#2-what-problem-does-it-solve)
3. [Why did you choose SQLite?](#3-why-did-you-choose-sqlite)
4. [What is FTS5 and how is it implemented?](#4-what-is-fts5-and-how-is-it-implemented)
5. [How does Gemini decide to search the web?](#5-how-does-gemini-decide-to-search-the-web)
6. [What is function calling and how does it work?](#6-what-is-function-calling-and-how-does-it-work)
7. [Why Tavily instead of Google Custom Search or Bing?](#7-why-tavily-instead-of-google-custom-search-or-bing)
8. [How does the agent avoid infinite tool loops?](#8-how-does-the-agent-avoid-infinite-tool-loops)
9. [How are memories extracted and stored?](#9-how-are-memories-extracted-and-stored)
10. [How does Recall distinguish historical information from current information?](#10-how-does-recall-distinguish-historical-information-from-current-information)
11. [How do citations work?](#11-how-do-citations-work)
12. [What happens when an external API fails?](#12-what-happens-when-an-external-api-fails)
13. [What are the known limitations of this architecture?](#13-what-are-the-known-limitations-of-this-architecture)
14. [What would you improve with more time?](#14-what-would-you-improve-with-more-time)

---

## 1. What is Recall?

### Simple Explanation
Recall is a clean, minimal conversational AI research assistant built with TypeScript, Fastify, and SQLite. It remembers past conversations, technical decisions, and user preferences across sessions, and autonomously searches the internet via Tavily to answer current questions with verified source citations.

### Technical Explanation
Recall is a single-process Node.js service that orchestrates:
- **Local Persistence**: An embedded SQLite database (`better-sqlite3`) managing threads, messages, and structured memories, with an FTS5 virtual table for BM25 full-text keyword indexing (`src/database/db.ts`).
- **Context Construction Engine**: A multi-tiered context builder that combines recent dialogue, BM25-ranked historical messages, date-filtered records, and cross-conversation memories (`src/agent/context.ts`).
- **Reasoning & Tool Execution**: Google Gemini (`gemini-2.5-flash` via `@google/genai`) configured with native function declarations (`web_search`), executing within a bounded tool loop (`src/agent/chat.ts`).
- **Web Grounding**: Tavily Search API client (`@tavily/core`) returning sanitized, deduplicated snippets and metadata (`src/tools/web-search.ts`).

### Follow-up Questions
- **Q: Why avoid LangChain or LangGraph?**  
  *A:* Frameworks like LangChain introduce heavy abstractions, dynamic monkey-patching, difficult debugging, and frequent breaking changes. By writing a direct Fastify orchestrator with `@google/genai`, the entire tool-calling loop is ~50 lines of readable, inspectable TypeScript that runs faster and has zero framework overhead.

---

## 2. What problem does it solve?

### Simple Explanation
Standard AI chatbots suffer from **context amnesia** (they forget previous conversations, preferences, and project decisions once a session ends) and **knowledge stagnation** (they hallucinate or provide obsolete answers because of outdated training cutoffs). Recall solves both without requiring complex vector infrastructure.

### Technical Explanation
1. **Context Amnesia**: Addressed via relational storage and hybrid retrieval. Historical messages are indexed in SQLite FTS5 with automatic trigger synchronization. User preferences and architectural choices are extracted asynchronously into a structured `memories` table (`fact`, `decision`, `preference`, `constraint`) and queried across sessions.
2. **Knowledge Stagnation**: Addressed via autonomous LLM tool calling. Gemini evaluates the user's prompt against its knowledge cutoff; if current releases, pricing, or verification are required, it issues structured function calls to Tavily to retrieve fresh web snippets and grounds its answer with verifiable citations.

### Follow-up Questions
- **Q: Can't you just pass the entire chat history in every prompt?**  
  *A:* Passing full history blows up prompt token costs, degrades LLM attention (the "lost-in-the-middle" phenomenon), and eventually exceeds the context window. Recall uses a 6-message recent window combined with BM25 relevance ranking and structured memory extraction to keep context concise (~500–1,500 tokens).

---

## 3. Why did you choose SQLite?

### Simple Explanation
SQLite is an embedded, zero-configuration database that runs directly inside the Node.js process. It gives us sub-millisecond query performance and ACID transactions without needing to set up, maintain, or pay for external database servers.

### Technical Explanation
- **Process Colocation**: Using `better-sqlite3`, queries execute synchronously on the V8 thread with zero network serialization latency, unlike PostgreSQL or MongoDB.
- **ACID & Durability**: Configured with `PRAGMA journal_mode = WAL;` (Write-Ahead Logging) which allows concurrent readers without blocking writers, and `PRAGMA foreign_keys = ON;` to enforce relational integrity and cascade deletes.
- **Embedded Full-Text Search**: SQLite includes FTS5 out of the box, eliminating the need for external search clusters like Elasticsearch.
- **Simplicity & Portability**: The entire database state resides in a single file (`./data/recall.db`), making backups, evaluations, testing, and interview demonstrations trivial to run locally.

### Follow-up Questions
- **Q: Isn't synchronous better-sqlite3 blocking Node's event loop?**  
  *A:* For an embedded SQLite database handling key-value, indexed B-Tree, and FTS5 lookups, queries take 0.05 to 0.5 milliseconds—faster than the network round-trip of an async call to an external database. For CPU-bound bulk operations, worker threads can be introduced, but for conversational loads, synchronous SQLite is exceptionally fast.

---

## 4. What is FTS5 and how is it implemented?

### Simple Explanation
FTS5 is SQLite's built-in full-text search engine. It creates an inverted index of message text and allows us to search through thousands of historical messages in fractions of a millisecond, ranking results by relevance using the BM25 algorithm.

### Technical Explanation
- **Virtual Table Setup**: Created via:
  ```sql
  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    message_id UNINDEXED,
    conversation_id UNINDEXED,
    content,
    tokenize = 'porter unicode61'
  );
  ```
  We use the `porter unicode61` tokenizer to support word stemming (e.g., searching for "running" matches "run").
- **Automatic Trigger Synchronization**: Kept in sync with the primary `messages` table via three database triggers:
  1. `messages_ai`: `AFTER INSERT ON messages` inserts into `messages_fts`.
  2. `messages_ad`: `AFTER DELETE ON messages` removes from `messages_fts`.
  3. `messages_au`: `AFTER UPDATE ON messages` updates `messages_fts`.
- **Query Ranking**: In `src/memory/messages.ts`, search terms are extracted, cleaned, and combined with `OR` expressions (e.g. `"fastify"* OR "postgresql"*`). Queries select `ORDER BY rank ASC` where negative BM25 scores represent the strongest relevance matches.

### Follow-up Questions
- **Q: Why join tokens with OR instead of AND?**  
  *A:* In natural conversational queries like *"Which database did we select last week?"*, requiring an exact boolean `AND` across every conversational stop-word causes zero matches if one word is missing. Joining meaningful keyword tokens with `OR` lets SQLite's BM25 algorithm rank messages containing the most matching terms at the top.

---

## 5. How does Gemini decide to search the web?

### Simple Explanation
Gemini makes the decision autonomously using native function calling. We pass it the definition of our `web_search` tool, and the model's internal attention mechanism determines whether answering the prompt requires live information or if it can answer directly from its pre-trained knowledge.

### Technical Explanation
- In `src/agent/tools.ts`, we define `webSearchTool` using the `@google/genai` declaration format:
  ```typescript
  export const webSearchTool = {
    functionDeclarations: [{
      name: 'web_search',
      description: 'Search the web for up-to-date information...',
      parameters: {
        type: Type.OBJECT,
        properties: { query: { type: Type.STRING } },
        required: ['query'],
      },
    }],
  };
  ```
- In `src/agent/chat.ts`, the `SYSTEM_PROMPT` gives explicit guidelines:
  - Answer conceptual/programming basics directly (e.g., *"What is an interface in TypeScript?"*).
  - Search for current releases, pricing, live events, or factual verification.
- When `generateResponseWithTools()` calls the Gemini API, the model returns either a conversational text response or a `functionCalls` array. If a function call is present, our server executes the tool.

### Follow-up Questions
- **Q: Can the model hallucinate tool parameters?**  
  *A:* Yes, which is why we validate the tool arguments using Zod before passing them to Tavily (`z.string().min(1)`), and check for empty or non-string arguments.

---

## 6. What is function calling and how does it work?

### Simple Explanation
Function calling is a capability where an LLM does not execute code directly; instead, it outputs a structured JSON object specifying a function name and arguments that it wants the hosting application to execute on its behalf.

### Technical Explanation
The function-calling protocol is a multi-step handshake:
1. **Tool Declaration**: The client sends the user message along with a list of callable function schemas (name, description, parameter types).
2. **Model Invocation**: The model determines a tool is needed and emits a `functionCall` part: `{ name: 'web_search', args: { query: 'Fastify v5 release date' } }`.
3. **Client Execution**: Our Fastify server detects the call, executes `searchWeb(query)` locally, and captures the structured output.
4. **Tool Response Turn**: The server sends a second request to Gemini appending the `functionResponse` part containing the search output.
5. **Final Synthesis**: Gemini ingests the search data, generates the final natural language answer, and applies bracketed citations (`[1]`).

---

## 7. Why Tavily instead of Google Custom Search or Bing?

### Simple Explanation
Tavily is an AI-native search engine designed specifically for LLMs. Instead of returning raw HTML pages filled with ads, navigation bars, and cookies, it returns clean, pre-filtered text snippets, publication dates, and source URLs optimized for prompt injection.

### Technical Explanation
- **Token Efficiency**: Raw web scraping requires downloading megabytes of HTML, stripping boilerplate with Cheerio or Playwright, and chunking text. Tavily returns concise, high-density 200–300 character snippets that fit directly into context windows.
- **Structured Metadata**: Tavily returns clean ISO `published_date` fields, accurate page titles, and canonical URLs out-of-the-box, simplifying citation generation.
- **Lower Operational Overhead**: Google Custom Search requires configuring Search Engine IDs (CX), GCP billing, and custom scrapers; Bing requires Azure cognitive service provisioning. Tavily requires a single API key with minimal configuration.

---

## 8. How does the agent avoid infinite tool loops?

### Simple Explanation
We enforce a strict maximum limit of 3 search iterations per turn, track and reject duplicate search queries, and require the model to synthesize an answer if limits are reached.

### Technical Explanation
In `src/agent/chat.ts` (`executeToolCallsWithLoop`):
```typescript
let iterationCount = 0;
const maxIterations = 3;
const visitedQueries = new Set<string>();

while (iterationCount < maxIterations) {
  // 1. Check for function calls
  if (!response.functionCalls || response.functionCalls.length === 0) break;
  
  // 2. Validate tool name and parameters via Zod
  const query = call.args.query.trim().toLowerCase();
  
  // 3. Duplicate suppression
  if (visitedQueries.has(query)) {
    // Send message back to model prompting synthesis instead of re-searching
    break;
  }
  visitedQueries.add(query);
  
  // 4. Increment iteration counter
  iterationCount++;
  // ... execute Tavily and call Gemini again ...
}
```
If 3 iterations are exhausted, the loop breaks and the model produces an answer with the accumulated research.

---

## 9. How are memories extracted and stored?

### Simple Explanation
After sending a chat reply to the user, an asynchronous background task sends the user's message to Gemini with instructions to extract any concrete facts, decisions, preferences, or constraints into structured JSON, which is then deduplicated and saved to SQLite.

### Technical Explanation
- **Schema**: Memories are stored in the `memories` table:
  - `id` (UUID), `conversation_id`, `type` (`fact`, `decision`, `preference`, `constraint`), `subject`, `content`, `source_message_id`, `created_at`.
- **Extraction (`src/agent/memory-extractor.ts`)**:
  - We prompt Gemini with the user message and a strict JSON schema.
  - The model returns an array of structured entities:
    ```json
    [{"type": "decision", "subject": "database", "content": "PostgreSQL selected for primary storage"}]
    ```
- **Deduplication**: Before saving, the system queries existing memories for that conversation. If an identical subject and content combination already exists, it is discarded to prevent database bloat.
- **Asynchronous Execution**: Memory extraction is triggered via an unawaited promise in `src/agent/chat.ts`, ensuring the user receives their response immediately without waiting for the second LLM extraction pass.

---

## 10. How does Recall distinguish historical information from current information?

### Simple Explanation
Recall anchors the LLM with today's calendar date in the system prompt, labels historical messages and past decisions with their original timestamps, and prompts the model to distinguish publication dates from retrieval dates.

### Technical Explanation
1. **Dynamic Temporal Grounding**: The system prompt in `src/agent/chat.ts` is generated dynamically with:
   ```typescript
   Current Date: ${new Date().toISOString().split('T')[0]}
   ```
   This gives the model an objective reference for terms like *"yesterday"*, *"last month"*, or *"current release"*.
2. **Context Labeling**: In `src/agent/context.ts`, messages are tagged with their timestamps (`[2026-11-05T10:00:00Z] user: ...`), and cross-conversation memories are tagged with `[from earlier conversation]`.
3. **Date-Specific SQL Lookup**: When a user asks about a specific calendar date (e.g. *"What did we discuss on November 5th?"*), `extractDateQuery()` regex-matches the date and executes `getMessagesByDate()` using SQLite's `date(created_at) = date(?)`.
4. **Citation Publication Metadata**: Tavily snippets include `published_at`. Gemini is instructed: *"Distinguish publication dates from retrieval dates. If a publication date is unavailable, say so rather than guessing."*

---

## 11. How do citations work?

### Simple Explanation
When web search results are sent to Gemini, each result is labeled with an index number like `[1]`, `[2]`. Gemini cites these numbers inline in its answer, and the backend attaches the full source metadata (title, URL, domain, timestamp) to the API response.

### Technical Explanation
1. **Result Indexing**: In `chat.ts`, web search results are formatted into numbered blocks for the LLM:
   ```text
   [1] Fastify v5 Release Notes
   URL: https://github.com/fastify/fastify/releases/tag/v5.0.0
   Snippet: Fastify v5 is now released...
   ```
2. **System Prompt Constraint**: The prompt commands: *"When web search results are provided, cite the relevant sources using numbered brackets like [1], [2]. Never invent or fabricate URLs or citations."*
3. **Structured API Response**: The endpoint returns:
   ```json
   {
     "reply": "Fastify v5 is the latest release [1]...",
     "sources": [{ "title": "...", "url": "...", "domain": "github.com", "retrieved_at": "..." }]
   }
   ```
   This enables the frontend to map `[1]` to an interactive tooltip or link using verified URLs.

---

## 12. What happens when an external API fails?

### Simple Explanation
User messages are saved in SQLite first so no data is ever lost. If Tavily fails (such as hitting a rate limit), the error is caught and Gemini is told search results were unavailable, leading it to admit lack of verification. If Gemini fails, the route returns an error while keeping the user message safely stored.

### Technical Explanation
- **Data Durability First**: In `src/agent/chat.ts`, `saveMessage(conversationId, 'user', userMessage)` is executed **before** calling Gemini or Tavily. Even if the network drops or an API throws a 500/503 error, the user's message is preserved in SQLite.
- **Tavily Degradation**: In `src/tools/web-search.ts`, the search call is wrapped in a `try/catch` block. If Tavily returns a 429 (rate limit) or network error, it logs the failure and safely returns an empty array `[]`.
- **Honest Disclosure**: Gemini's prompt instructs: *"If web search yields no results or fails, clearly disclose that current information could not be verified rather than asserting outdated knowledge as fresh."*
- **Memory Extraction Isolation**: If `extractMemories()` encounters an error, the error is logged without failing the user's chat response.

---

## 13. What are the known limitations of this architecture?

### Simple Explanation
SQLite FTS5 relies on keyword matches rather than semantic concepts, single-instance SQLite does not scale horizontally across multiple geographical regions out-of-the-box, and asynchronous memory extraction can experience brief race conditions under rapid concurrent messages.

### Technical Explanation
1. **Lexical vs. Semantic Gap**: FTS5 uses BM25 token matching and Porter stemming. If a user states *"I want to use Postgres"* and later asks *"Which relational database did I pick?"*, BM25 may not match unless the word "database" was mentioned. Vector embeddings would bridge this semantic synonym gap.
2. **Single-Writer Concurrency**: SQLite serializes write transactions. While WAL mode enables concurrent readers, write throughput is limited to a single Node.js process writing to disk (typically a few thousand writes/sec, which is more than enough for a chatbot but not for globally distributed multi-region writes).
3. **Snippet Quality Dependency**: The synthesis is only as good as the search snippets returned by Tavily. Behind-the-paywall content or client-side rendered JavaScript pages may return thin content.

---

## 14. What would you improve with more time?

### Simple Explanation
I would implement hybrid search (combining SQLite FTS5 with local vector embeddings), user authentication and multi-tenancy, real-time response streaming with Server-Sent Events, and memory versioning to handle conflicting decisions.

### Technical Explanation
1. **Hybrid Retrieval (BM25 + Dense Embeddings)**:
   - Integrate `sqlite-vss` or a lightweight local embedding model to compute cosine similarity alongside FTS5 BM25.
   - Use Reciprocal Rank Fusion (RRF) to merge lexical and semantic search results without introducing external cloud vector databases.
2. **Memory Conflict Resolution & Versioning**:
   - Add a `superseded_by` column and `status: 'active' | 'superseded'` to the `memories` table.
   - When Gemini extracts a decision that contradicts an earlier record (e.g. *"We switched from Postgres to MongoDB"*), mark the older memory as superseded rather than keeping conflicting facts active.
3. **Server-Sent Events (SSE) Streaming**:
   - Upgrade `POST /conversations/:id/chat` to stream response chunks in real time using Fastify's reply stream, improving perceived latency from ~1.5s down to <200ms TTFT (Time to First Token).
4. **Multi-Tenancy & Authorization**:
   - Introduce `users` and `organizations` tables with JWT authentication in Fastify hooks, ensuring complete tenant isolation across conversations and memory queries.

