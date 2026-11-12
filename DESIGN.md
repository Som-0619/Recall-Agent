# Recall Agent — System Architecture & Design

## 1. Problem Recall Solves
Conversational AI assistants suffer from **context amnesia** (forgetting architectural decisions and constraints across sessions) and **knowledge stagnation** (asserting stale training data for live facts like pricing or library releases). Existing solutions introduce heavy infrastructure (vector databases, embedding pipelines, multi-agent frameworks) that adds latency, non-deterministic retrieval, and operational bloat. Recall solves this with a lightweight, deterministic system: local embedded storage combined with grounded, autonomous web search.

---

## 2. Main System Data Flow

```text
User Request ──► Fastify HTTP Server (:3000) ──► Chat Orchestrator (src/agent/chat.ts)
                                                        │
     ┌──────────────────────────────────────────────────┴────────────────────────────────┐
     ▼                                                                                   ▼
1. Assemble Context (Before Insert)                                          2. Persist User Message
   ├── Recent dialogue (last 6 messages)                                        (Ensures durability)
   ├── SQLite FTS5 BM25 search (messages_fts OR-ranked)
   ├── Calendar-date retrieval (date(created_at) = date(?))
   └── Structured memories (local thread + cross-conversation)
     │
     ▼
3. Gemini Execution Loop (Max 5 Model Turns, Max 3 Tavily Searches)
   ├── Autonomous tool decision (direct answer vs web_search call)
   ├── Tool execution: Tavily search, URL deduplication, stable [1], [2] citation indices
   └── Grounded final answer synthesis referencing citation numbers
     │
     ▼
4. Response & Post-Turn Processing
   ├── Persist assistant reply with citations to SQLite
   └── Asynchronously extract structured memories (facts, decisions, preferences, constraints)
```

---

## 3. Technology Selection & Rationale

- **Fastify & TypeScript**: Low-overhead HTTP routing, native schema validation with Zod, and compile-time type safety.
- **SQLite with FTS5**: Zero external infrastructure, ACID durability, embedded sub-millisecond query speed, and deterministic BM25 keyword ranking via `messages_fts`.
- **Google Gemini (`gemini-2.5-flash`)**: First-party SDK with native function calling. The model autonomously decides when search is necessary based on query semantics.
- **Tavily Search API**: Purpose-built for LLM grounding; returns structured snippets, domain metadata, and publication dates without scraping boilerplate.

---

## 4. Rejected Alternatives

- **Vector Databases (Pinecone, Chroma, Milvus)**: Rejected because embedding models introduce non-deterministic retrieval, semantic drift on exact technical identifiers (e.g., error codes, library versions, model names), network latency, and unnecessary cloud hosting dependencies.
- **LangChain & LangGraph**: Rejected due to high abstraction bloat, rapid API churn, opaque execution flow, and debugging difficulty. A clean native loop provides complete control over tool execution bounds, query deduplication, and error recovery.

---

## 5. How Conversational Memory and Web Research Work Together
Memory and research operate as complementary stages in a single turn:
1. **Memory First**: The orchestrator queries SQLite to recover user constraints, decisions, and past dialogue (e.g., *"We chose Fastify and PostgreSQL"*).
2. **Context-Grounded Research**: Gemini receives this context and evaluates whether live facts are required (e.g., *"What is the latest stable version of Fastify?"*).
3. **Synthesis & Distinction**: The model combines historical decisions with live research, citing web sources with stable bracketed markers (`[1]`) while preserving past constraints.
4. **Memory Capture**: The turn concludes by asynchronously extracting new facts or decisions from the dialogue into SQLite without blocking response latency.

---

## 6. What Would Be Improved With Another Week of Development
- **Contradiction Invalidation**: Add `superseded_by` pointers in the `memories` table to automatically invalidate outdated decisions when newer contradictory choices are recorded.
- **Hybrid Retrieval**: Supplement FTS5 BM25 with local `sqlite-vss` embeddings for semantic synonym matching without external vector services.
- **Response Streaming**: Implement Server-Sent Events (SSE) on `/conversations/:id/chat` for token-by-token streaming.
- **User Identity & Multi-Tenancy**: Add `user_id` foreign keys to isolate conversation threads and memory namespaces across multiple users.
