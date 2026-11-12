# Recall Agent

Recall is a clean, minimal, modular conversational AI research assistant built with Node.js, Fastify, TypeScript, and SQLite. It combines persistent local memory with autonomous internet research: the agent remembers past conversations, architectural decisions, and user preferences across sessions, while dynamically invoking Tavily web search via Google Gemini function calling whenever up-to-date real-world facts are required.

---

## 1. Problem Statement

Most conversational AI assistants suffer from two complementary weaknesses:
1. **Context Amnesia**: They forget user preferences, project constraints, and architectural decisions once a session ends or exceeds the context window.
2. **Knowledge Stagnation**: They hallucinate or rely on outdated training cutoffs when asked about current pricing, recent library releases, or live market facts.

Existing solutions often address this with heavy abstractions (vector databases, embedding pipelines, agent graphs, multi-agent frameworks) that introduce operational complexity, network latency, non-deterministic retrieval, and maintenance overhead. 

**Recall** solves this using a lightweight, deterministic architecture: SQLite with FTS5 for relational and full-text keyword memory, paired with native LLM tool calling for grounded web search.

---

## 2. Key Features

- **Persistent Relational Memory**: Conversations, raw messages, and structured memories are stored in SQLite with foreign keys and strict schemas.
- **FTS5 Full-Text Message Search**: Message history is indexed via SQLite's FTS5 virtual table with BM25 relevance ranking and automated trigger synchronization.
- **Automatic Structured Memory Extraction**: Asynchronously extracts structured facts, decisions, preferences, and constraints from user messages using Gemini without blocking user latency.
- **Autonomous Tool-Grounded Research**: Gemini natively calls the `web_search` tool only when queries demand current information or verification.
- **Bounded Tool Execution**: Tool loops are strictly capped at a maximum of 3 iterations with duplicate query detection to eliminate runaway recursion and API cost spikes.
- **Verifiable In-Text Citations**: Responses ground web claims with bracketed citations (`[1]`, `[2]`) linked to verified sources with titles, URLs, domains, and retrieval timestamps.
- **Cross-Conversation Recall**: Searches across historical conversation threads and surfaces relevant past decisions and preferences labeled with `[from earlier conversation]`.
- **Date-Specific Recall**: Automatically detects calendar dates in queries and extracts exact messages matching the target date using SQLite's `date()` function.
- **Graceful Failure Degradation**: In the event of Tavily rate limits or upstream Gemini errors, the system protects user data durability and returns clear uncertainty disclosures instead of hallucinating.

---

## 3. Technology Stack

| Component | Technology | Purpose | Version / Note |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | React, TypeScript, Vite, Tailwind CSS | Clean workspace with memory panel & Demo Mode | React 18, Vite 5 |
| **Icons** | Lucide React | Minimal UI iconography | `^0.395.0` |
| **Runtime** | Node.js | Server execution environment | `>= 20.0.0` |
| **Language** | TypeScript | Strict type safety and interface definitions | `^5.4.5` |
| **Web Framework** | Fastify | High-performance, low-overhead HTTP server | `^4.27.0` |
| **Database** | SQLite (`better-sqlite3`) | Synchronous, embedded relational storage and FTS5 engine | `^9.6.0` |
| **LLM Provider** | Google Gemini (`@google/genai`) | Reasoning, context synthesis, tool calling, memory extraction | `gemini-2.5-flash` (`^0.1.1`) |
| **Web Search** | Tavily Search (`@tavily/core`) | Clean, AI-optimized web snippet and metadata retrieval | `^1.0.0` |
| **Validation** | Zod | Schema validation for environment and HTTP endpoints | `^3.23.8` |
| **Testing** | Node.js Test Runner & `tsx` | Native test runner for unit, integration, and benchmarks | Zero external test dependencies |

---

## 4. Architecture Overview

```text
                        ┌────────────────────────┐
                        │   Client HTTP Request  │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │ Fastify Server (:3000) │
                        └───────────┬────────────┘
                                    │
                                    ▼
                        ┌────────────────────────┐
                        │ Chat Orchestrator      │
                        │ (src/agent/chat.ts)    │
                        └─────┬────────────┬─────┘
                              │            │
            1. Save Message   │            │ 2. Build Context
                              ▼            ▼
                     ┌───────────────────────────────┐
                     │ SQLite Persistent Database    │
                     │  - messages (recent dialogue) │
                     │  - messages_fts (BM25 search) │
                     │  - memories (facts, decisions)│
                     └──────────────┬────────────────┘
                                    │
                                    ▼ Context + System Prompt
                        ┌────────────────────────┐
                        │ Google Gemini LLM      │
                        └───────────┬────────────┘
                                    │
                  Tool Call Needed? │
                  ┌─────────────────┴─────────────────┐
                  ▼ YES                               ▼ NO
       ┌─────────────────────┐             ┌─────────────────────┐
       │ Bounded Tool Loop   │             │ Direct Synthesis    │
       │ (max 3 searches)    │             └──────────┬──────────┘
       │  - Tavily Search    │                        │
       │  - Deduplicate URLs │                        │
       └──────────┬──────────┘                        │
                  │ Tool Output                       │
                  ▼                                   │
       ┌─────────────────────┐                        │
       │ Gemini Synthesis    │                        │
       │ (with [1] citations)│                        │
       └──────────┬──────────┘                        │
                  ├───────────────────────────────────┘
                  ▼
       ┌────────────────────────┐
       │ 3. Save Assistant Msg  │
       │ 4. Extract Memories    │──► (Async Gemini call saves to SQLite)
       │ 5. Return JSON Result  │
       └────────────────────────┘
```

---

## 5. Project Directory Structure

```text
recall-agent/
├── data/                      # Local SQLite database directory (recall.db)
├── dist/                      # Compiled JavaScript production build output
├── docs/                      # Architectural, benchmark, and API documentation
│   ├── API.md                 # Complete HTTP REST endpoint reference
│   ├── DEMO.md                # 5-minute live interactive demonstration script
│   ├── EVALUATION.md          # Benchmark results across 24 test cases
│   └── INTERVIEW_GUIDE.md     # 14 interview Q&As with simple & technical answers
├── src/                       # TypeScript source code
│   ├── agent/                 # LLM, context, and orchestration logic
│   │   ├── chat.ts            # Core chat orchestrator and tool execution loop
│   │   ├── context.ts         # Multi-tiered context builder (recent + FTS5 + memories)
│   │   ├── gemini.ts          # Gemini SDK client wrapper and tool calling handler
│   │   ├── memory-extractor.ts# Structured memory extraction service
│   │   └── tools.ts           # Gemini tool definitions (web_search)
│   ├── config/                # Environment variables and Zod schema
│   │   └── env.ts             # Validated environment configuration
│   ├── database/              # SQLite database initialization
│   │   └── db.ts              # Connection management, tables, and FTS5 triggers
│   ├── evaluation/            # Automated benchmark evaluation suite
│   │   ├── cli.ts             # CLI command runner for benchmarks
│   │   ├── dataset.ts         # 24 evaluation test cases across 6 categories
│   │   ├── metrics.ts         # Accuracy, recall, and reliability calculators
│   │   └── runner.ts          # End-to-end evaluation runner engine
│   ├── memory/                # Database repositories and queries
│   │   ├── conversation.ts    # Conversation CRUD operations
│   │   ├── memories.ts        # Structured memory storage and keyword lookup
│   │   └── messages.ts        # Message persistence and FTS5 BM25 search
│   ├── routes/                # Fastify HTTP route handlers
│   │   ├── conversations.ts   # /conversations, /messages, /memories, /chat
│   │   └── search.ts          # /search (FTS5 message search)
│   ├── tools/                 # External service integrations
│   │   └── web-search.ts      # Tavily Search API client with sanitization
│   └── server.ts              # Fastify server startup and entry point
├── frontend/                  # React + TypeScript + Vite + Tailwind CSS UI
│   ├── src/
│   │   ├── components/        # Layout, Chat, and Memory panel components
│   │   ├── services/          # Fastify API client & Demo Mode simulator
│   │   └── types/             # Frontend shared TypeScript interfaces
│   ├── package.json
│   └── vite.config.ts         # Proxies /conversations, /search, /health to :3000
├── tests/                     # Automated unit and integration test suites
│   ├── memory.test.ts         # Phase 2 database & FTS5 tests (8 tests)
│   ├── phase3.test.ts         # Phase 3 context & memory extraction tests (11 tests)
│   ├── phase4.test.ts         # Phase 4 tool loop & citation tests (14 tests)
│   └── phase5.test.ts         # Phase 5 reliability & benchmark tests (7 tests)
├── .env.example               # Template for environment variables
├── .gitignore                 # Ignored files (node_modules, .env, data/*.db)
├── DESIGN.md                  # One-page system design and trade-offs
├── package.json               # Dependencies and scripts
├── README.md                  # Comprehensive project documentation
└── tsconfig.json              # TypeScript compiler configuration
```

---

## 6. Prerequisites

- **Node.js**: `v20.0.0` or higher.
- **npm**: `v9.0.0` or higher.
- **Google Gemini API Key** *(optional for offline tests & Demo Mode)*: From [Google AI Studio](https://aistudio.google.com/).
- **Tavily API Key** *(optional for offline tests & Demo Mode)*: From [Tavily](https://tavily.com/).

---

## 7. Installation Instructions

Follow these steps for a clean clone setup:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Som-0619/Recall-Agent.git
   cd Recall-Agent
   ```

2. **Install backend dependencies**:
   ```bash
   npm install
   ```

3. **Install frontend dependencies**:
   ```bash
   npm --prefix frontend install
   ```

---

## 8. Environment Configuration

The backend starts and offline tests run without any API keys configured. API keys are validated only when live Gemini generation or live Tavily web search is executed.

1. Create a `.env` file from the example template:
   ```bash
   cp .env.example .env
   ```

2. *(Optional)* Add your credentials to `.env`:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_gemini_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   MODEL_NAME=gemini-2.5-flash
   DATABASE_PATH=./data/recall.db
   ```
   > **Security Note**: Never commit your `.env` file. It is explicitly ignored by `.gitignore`.

### Environment Variables Explained

| Variable | Required | Default | Description |
| :--- | :---: | :---: | :--- |
| `PORT` | No | `3000` | Port for the Fastify HTTP server |
| `GEMINI_API_KEY`| No (Live mode only) | `""` | Google Gemini API key (validated only when live generation is invoked) |
| `TAVILY_API_KEY`| No (Live mode only) | `""` | Tavily Search API key (validated only when live web search is invoked) |
| `MODEL_NAME` | No | `gemini-2.5-flash` | Gemini model identifier |
| `DATABASE_PATH` | No | `./data/recall.db` | Relative or absolute path to SQLite file |

---

## 9. How to Run Locally

### Start Backend Server
Starts the Fastify backend server on port 3000 with auto-reload using `tsx`:
```bash
npm run dev
```

### Start Frontend Client
Starts the React + Vite development server on port 5173:
```bash
npm run client
# Or: cd frontend && npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

### Understanding App Modes: Demo Mode vs. Live Mode

The frontend includes a toggle in the sidebar between two distinct execution modes:

1. **Demo Mode (Simulated — Zero API Keys Required)**:
   - Uses simulated client-side logic to demonstrate memory extraction, historical recall, and web research grounding.
   - Shows sample architectural decisions, past dialogue, and mock citations `[1]`, `[2]`.
   - Simulated responses are clearly flagged with `[SIMULATED RESPONSE]` so they are never confused with real AI output.
   - Operates completely offline without requiring credentials or a running backend.

2. **Live Backend Mode (Real AI & Storage)**:
   - Connects to the Fastify server at `http://localhost:3000`.
   - Persists all dialogue and memories in local SQLite tables.
   - Performs actual FTS5 BM25 message searches.
   - Requires valid `GEMINI_API_KEY` (and `TAVILY_API_KEY` for live web queries).

---

### Build and Run for Production

```bash
# 1. Compile backend TypeScript into dist/
npm run build

# 2. Compile frontend assets into frontend/dist/
npm run build:client

# 3. Start production backend server
npm start
```

### Type Checking
Validates TypeScript types without emitting build artifacts:
```bash
npm run typecheck
```

---

### Testing: Offline Unit Tests vs. Live Tests

- **Offline Automated Tests (`npm test`)**: Runs all 40 unit and integration tests using mocked external API clients. Requires **zero** API keys and makes zero external network requests:
  ```bash
  npm test
  ```
- **Offline Benchmark Evaluation (`npm run evaluate`)**: Runs the 24 evaluation scenarios through Recall's actual context assembly and bounded tool loop using controlled test doubles:
  ```bash
  npm run evaluate
  ```

---

## 10. API Documentation Summary

See [`docs/API.md`](docs/API.md) for complete request schemas, response codes, and examples.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server health check (`{ "status": "ok", "app": "Recall" }`) |
| `POST` | `/conversations` | Create a new conversation thread |
| `GET` | `/conversations` | List all conversation threads |
| `GET` | `/conversations/:id` | Retrieve metadata for a specific conversation |
| `PATCH` | `/conversations/:id` | Update conversation title |
| `DELETE` | `/conversations/:id` | Delete conversation and cascade-delete its messages and memories |
| `POST` | `/conversations/:id/messages` | Save a raw user or assistant message |
| `GET` | `/conversations/:id/messages` | List messages in chronological order (optional `?limit=N`) |
| `POST` | `/conversations/:id/memories` | Manually store a structured memory item |
| `GET` | `/conversations/:id/memories` | List all structured memories for a conversation |
| `GET` | `/search?q=keyword` | Full-text search across all messages using SQLite FTS5 |
| `POST` | `/conversations/:id/chat` | Send a chat message; searches web if needed, cites sources, extracts memories |

---

## 11. Example API Requests and Responses

### 1. Create a Conversation
```bash
curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Backend Architecture"}'
```
**Response (201 Created)**:
```json
{
  "id": "c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
  "title": "Backend Architecture",
  "created_at": "2026-11-11T12:00:00.000Z",
  "updated_at": "2026-11-11T12:00:00.000Z"
}
```

### 2. Send a Message (Memory Storage & Recall)
```bash
curl -X POST http://localhost:3000/conversations/c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "We have chosen Fastify and PostgreSQL for our stack."}'
```
**Response (200 OK)**:
```json
{
  "conversation_id": "c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
  "user_message_id": "m1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
  "reply": "Understood! I have noted that you've chosen Fastify and PostgreSQL for your backend stack.",
  "saved_memories": 1,
  "sources": []
}
```

### 3. Send a Message Requiring Live Web Research
```bash
curl -X POST http://localhost:3000/conversations/c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the latest stable version of Fastify and what are its key features?"}'
```
**Response (200 OK)**:
```json
{
  "conversation_id": "c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
  "user_message_id": "m2b3c4d5-6e7f-8a9b-0c1d-2e3f4a5b6c7d",
  "reply": "Fastify v5 is the current major release [1]. Key enhancements include full Node.js v20+ support, improved schema validation performance, and streamlined plugin encapsulation [2].",
  "saved_memories": 0,
  "sources": [
    {
      "title": "Fastify v5.0.0 Release Notes",
      "url": "https://github.com/fastify/fastify/releases/tag/v5.0.0",
      "content": "Fastify v5 released with breaking changes...",
      "published_at": "2024-09-24T10:00:00Z",
      "domain": "github.com",
      "retrieved_at": "2026-11-11T12:05:00.000Z"
    },
    {
      "title": "Fastify Documentation",
      "url": "https://fastify.dev/docs/latest",
      "content": "Official documentation for Fastify...",
      "published_at": null,
      "domain": "fastify.dev",
      "retrieved_at": "2026-11-11T12:05:00.000Z"
    }
  ]
}
```

### 4. Search Historical Messages (FTS5 Full-Text)
```bash
curl -X GET "http://localhost:3000/search?q=PostgreSQL"
```
**Response (200 OK)**:
```json
[
  {
    "id": "m1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c",
    "conversation_id": "c1f7b8a2-3d4e-4f5a-8b9c-0d1e2f3a4b5c",
    "role": "user",
    "content": "We have chosen Fastify and PostgreSQL for our stack.",
    "created_at": "2026-11-11T12:00:00.000Z",
    "rank": -1.234
  }
]
```

---

## 12. How Memory Retrieval Works

Recall uses a 5-tier context assembly pipeline before calling Gemini:

1. **Chronological Dialogue Window**: Fetches the most recent 6 messages in the active conversation thread to maintain conversational coherence.
2. **SQLite FTS5 BM25 Ranking**: Extracts alphanumeric keyword tokens from the user's message, joins them using `OR` expressions (e.g., `"fastify"* OR "postgresql"*`), and queries the `messages_fts` virtual table using SQLite's BM25 ranking algorithm (`ORDER BY rank ASC`).
3. **Calendar Date Detection**: Evaluates whether the prompt mentions a specific date (`YYYY-MM-DD`, `Month Day, Year`). If detected, it executes an exact SQLite `date(created_at) = date(?)` lookup to retrieve timestamp-accurate dialogue.
4. **Structured Memory Retrieval**: Searches the `memories` table for explicit facts, decisions, preferences, and constraints related to the prompt.
5. **Cross-Conversation Boundary Management**: Keyword-matching memories from other conversations are retrieved and prefixed with `[from earlier conversation]`, allowing the model to recall decisions made in prior sessions while keeping conversation threads logically isolated.
6. **Deduplication**: Ensures messages present in the recent window are not repeated in the historical FTS5 section.

---

## 13. How Web Search and Citations Work

1. **Autonomous Tool Activation**: Gemini is provided with the `web_search` tool definition. The system prompt instructs Gemini to invoke the tool *only* for current events, pricing, releases, or factual verification. Conceptual queries (e.g., *"What is SQLite?"*) are answered immediately without tool calls.
2. **Bounded Loop Control**: If Gemini requests a tool call, `chat.ts` executes `searchWeb(query)` via Tavily. The loop runs up to a maximum of 3 iterations.
3. **Duplicate Prevention**: The orchestrator tracks query strings within the turn. If Gemini requests an identical query twice, the call is rejected with a message prompting synthesis.
4. **Source Deduplication & Sanitization**: Tavily snippets are sanitized, URLs are validated (`http`/`https`), domains are extracted, and duplicate URLs are stripped.
5. **Bracketed Citation Grounding**: Search results are passed back to Gemini formatted as `[1]`, `[2]`, etc. Gemini cites them inline. The raw structured metadata is returned in the API response `sources` array for client-side rendering.

---

## 14. How to Run Tests and Evaluation

### Automated Test Suite
```bash
npm test
```
Runs all 40 unit and integration tests across 4 test suites (100% offline, zero API calls):
- `tests/memory.test.ts`: Tests SQLite initialization, conversation CRUD, message persistence, FTS5 triggers, and structured memory storage (8 tests).
- `tests/phase3.test.ts`: Tests context construction, duplicate filtering, date extraction, structured memory extraction, and zero prompt duplication (11 tests).
- `tests/phase4.test.ts`: Tests Tavily tool integration, URL extraction, bounded tool loop (max 3 searches, max 5 model turns), stable sequential citations, and credential validation (14 tests).
- `tests/phase5.test.ts`: Tests cross-conversation retrieval, date filtering, 429 rate limit handling, and duplicate query rejection (7 tests).

### Evaluation Benchmark
```bash
npm run evaluate
```
Runs the 24 evaluation scenarios across all 6 core competency categories:
1. Cross-Conversation Memory (4 cases)
2. Date-Specific Recall (4 cases)
3. Preference & Decision Recall (4 cases)
4. Current Web Research (4 cases)
5. Historical vs. Current Comparison (4 cases)
6. Failure Scenarios & Edge Cases (4 cases)

See [`docs/EVALUATION.md`](docs/EVALUATION.md) for full metrics and analysis.

---

## 15. Key Documentation Links

- [System Architecture & Design (DESIGN.md)](DESIGN.md)
- [Complete REST API Reference (docs/API.md)](docs/API.md)
- [Live Demonstration Script (docs/DEMO.md)](docs/DEMO.md)
- [Technical Interview Guide (docs/INTERVIEW_GUIDE.md)](docs/INTERVIEW_GUIDE.md)
- [Evaluation & Benchmark Report (docs/EVALUATION.md)](docs/EVALUATION.md)

---

## 16. Known Limitations and Future Improvements

### Current Limitations
- **BM25 Lexical Keyword Recall**: FTS5 matches literal tokens and stems. If a user asks a query using completely distinct synonyms without overlap, lexical search may not match.
- **Single Node SQLite**: Designed for single-instance embedded use with WAL mode enabled; not designed for multi-region horizontal scaling without replication (e.g. LiteFS or Turso).
- **Asynchronous Memory Extraction**: Memory extraction runs asynchronously in the background. In high-concurrency turns within milliseconds, a memory saved on turn N might be finalized shortly after turn N finishes.
- **Search Snippet Dependency**: Like all search-augmented systems, research synthesis relies on the fidelity of Tavily snippets. Highly paywalled sites or JS-heavy sites may return minimal snippets.

### Future Improvements
- **Hybrid Search (BM25 + Vector Embeddings)**: Combine SQLite FTS5 with local sqlite-vss embeddings for hybrid semantic and lexical retrieval without external cloud databases.
- **User Identity & Multi-Tenancy**: Add `user_id` scoping to isolate memory retrieval across multi-user environments.
- **Memory Invalidation & Superseding**: Add explicit `superseded_by` pointers when newer decisions contradict older decisions.
- **Streaming Responses**: Enable Server-Sent Events (SSE) on `/conversations/:id/chat` for real-time word-by-word streaming.
