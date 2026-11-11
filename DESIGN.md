# Recall Agent — System Architecture & Design

## 1. Problem & Core Idea
Conversational AI assistants suffer from **context amnesia** (forgetting decisions across sessions) and **knowledge stagnation** (outdated cutoffs for live facts). Existing solutions rely on heavy vector databases and complex agent graphs. 

**Recall** solves this using a lightweight, deterministic architecture: local embedded **SQLite with FTS5** for historical and full-text keyword memory, combined with **Google Gemini native tool calling** for bounded, grounded web research via **Tavily**.

---

## 2. System Architecture & Flow

```text
User Request ──► Fastify Server (:3000) ──► Chat Orchestrator (src/agent/chat.ts)
                                                      │
     ┌────────────────────────────────────────────────┴───────────────────────────────┐
     ▼                                                                                ▼
1. Build Context (Prior to insert)                                        2. Persist User Message
   ├── Recent dialogue (last 6 messages)                                     (Guarantees durability)
   ├── FTS5 BM25 search (messages_fts OR-ranked)
   ├── Date-specific filter (date(created_at) = date(?))
   └── Structured memories (conversational & cross-session)
     │
     ▼
3. Gemini Model Turn Loop (Max 5 Model Turns, Max 3 Searches)
   ├── Autonomous decision: answer directly vs call web_search
   ├── Input validation & duplicate query suppression
   ├── Tavily Search: sanitize URLs, extract domains, assign stable [1], [2] citations
   └── Final answer synthesis with bracketed citations
     │
     ▼
4. Response & Post-Turn Processing
   ├── Persist assistant message with citations
   └── Asynchronous structured memory extraction (facts, decisions, preferences, constraints)
```

---

## 3. Key Design Decisions & Rationale

| Decision | Rationale | Alternatives Considered & Rejected |
| :--- | :--- | :--- |
| **Fastify + TypeScript** | High throughput, sub-millisecond overhead, built-in schema validation, strict type safety. | Express (slower, older), NestJS (heavy OOP boilerplate). |
| **SQLite with FTS5** | Zero external infrastructure, ACID reliability, embedded sub-ms latency, deterministic BM25 keyword recall. | Pinecone / Chroma / Vector DBs (high latency, embedding drift, cost). |
| **Gemini Native Tool Calling** | First-party schema declaration; model autonomously activates tools based on need. | ReAct regex prompt parsing, LangChain agent executors (fragile, bloated). |
| **Tavily Search** | Clean, search-engine API purpose-built for LLM grounding with extracted publication dates. | Google Custom Search (complex provisioning), Puppeteer scraping (slow, brittle). |
| **Dual Loop Bounds** | Bounded at max 3 Tavily searches and max 5 Gemini model turns with safe fallbacks. | Unbounded tool loops, open multi-agent frameworks (infinite recursion risk). |

---

## 4. Reliability & Failure Handling
- **Persistence-First Durability**: User messages are stored in SQLite before any external API calls, ensuring zero message loss on LLM failure.
- **Graceful Search Degradation**: Tavily timeouts or 429 quota limits return empty results gracefully; Gemini discloses missing live verification rather than hallucinating.
- **Sequential Citation Stability**: Global citation indices (`[1]`, `[2]`) remain stable across repeated or multi-turn searches, aligning tool outputs with final source arrays.
- **Safe Fallback**: Model turn limits return a safe synthesis rather than crashing or looping indefinitely.

---

## 5. Limitations & Future Improvements
- **Contradiction Resolution**: Add `superseded_by` pointers in SQLite to automatically invalidate outdated facts when updated.
- **Hybrid Retrieval**: Complement FTS5 BM25 with local `sqlite-vss` embeddings for semantic synonym matching without cloud vector DBs.
- **Multi-Tenancy**: Add `user_id` partitioning across message history and memory retrieval.
- **Streaming**: Implement Server-Sent Events (SSE) for word-by-word streaming responses.
