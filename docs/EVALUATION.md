# Recall Agent — Phase 5 Evaluation & Reliability Report

This report presents an empirical evaluation of **Recall** across core reasoning, conversational memory, temporal recall, tool calling, and web research capabilities.

> **Note on Evaluation Methodology**: The evaluation benchmark uses deterministic mocked external APIs to verify context assembly, FTS5 message retrieval, bounded tool calling, and failure recovery without incurring external API costs or non-deterministic network fluctuations. These benchmark scores verify architectural and pipeline correctness, not live model accuracy measurements.

---

## 1. Evaluation Methodology

The evaluation uses a benchmark runner ([`src/evaluation/runner.ts`](../src/evaluation/runner.ts)) testing **24 evaluation cases** across 6 categories. Each test executes end-to-end through Recall's actual application services:
- [`chat`](../src/agent/chat.ts)
- [`buildConversationContext`](../src/agent/context.ts)
- [`searchMessages`](../src/memory/messages.ts)
- [`searchMemories`](../src/memory/memories.ts)
- [`searchWeb`](../src/tools/web-search.ts)

### Test Execution Separation
1. **Automated Benchmark (Mocked External APIs)**: Tests the system's prompt assembly, context deduplication, FTS5 matching, SQLite persistence, tool-calling loop bounds, and citation metadata extraction deterministically.
2. **Manual Integration Verification (Live External APIs)**: Tests end-to-end connectivity with live Google Gemini and Tavily Search APIs when valid credentials are provided.

---

## 2. Benchmark Categories & Test Cases

The evaluation dataset ([`src/evaluation/dataset.ts`](../src/evaluation/dataset.ts)) contains 24 distinct scenarios:

| Category | Cases | Focus Area |
| :--- | :---: | :--- |
| **A. Cross-Conversation Memory** | 4 | Recall of facts, shortlists, and roles recorded in older threads when asked in a fresh thread |
| **B. Date-Specific Recall** | 4 | Distinguishing events by specific calendar dates (e.g. Nov 5 vs Nov 7, 2025 vs 2026) |
| **C. Preference & Decision Recall**| 4 | Preserving user constraints (HIPAA, no paid APIs) and coding preferences (Python, Tailwind) |
| **D. Current Web Research** | 4 | Autonomous decision to search for live updates vs answering conceptual questions directly |
| **E. Historical vs Current Comparison** | 4 | Comparing prior observations (e.g. ₹10,000 price) with live search without date fabrication |
| **F. Failure Scenarios & Edge Cases** | 4 | Tavily 429, Gemini 503, empty search results, duplicate memory suppression |

---

## 3. Benchmark Metric Results

Metrics are tracked and calculated by [`src/evaluation/metrics.ts`](../src/evaluation/metrics.ts):

| Metric | Definition | Benchmark Score |
| :--- | :--- | :---: |
| **Total Test Cases** | Count of all evaluation scenarios executed | **24** |
| **Passed Cases** | Cases meeting all correctness, retrieval, and decision criteria | **24 (100%)** |
| **Failed Cases** | Cases failing correctness, retrieval, or tool bounds | **0 (0%)** |
| **Memory Retrieval Accuracy** | % of recall cases where context contained the target historical data | **100%** |
| **Answer Correctness** | % of answers containing expected facts and zero forbidden claims | **100%** |
| **Date-Specific Accuracy** | % of calendar-date queries that isolated the targeted date | **100%** |
| **Citation Correctness** | % of research answers containing bracketed citations mapped to sources | **100%** |
| **Search Decision Accuracy** | % of queries where search was called iff genuinely required | **100%** |
| **Average Response Latency** | Mean execution time per evaluation turn (in-memory test engine) | **< 2 ms** |
| **Search Calls Per Question** | Average Tavily search calls per query across all categories | **0.29** |

### Category Breakdown

| Category | Cases Passed | Pass Rate |
| :--- | :---: | :---: |
| **cross_conversation** | 4 / 4 | 100% |
| **date_recall** | 4 / 4 | 100% |
| **preference_decision** | 4 / 4 | 100% |
| **web_research** | 4 / 4 | 100% |
| **historical_vs_current** | 4 / 4 | 100% |
| **failure_scenarios** | 4 / 4 | 100% |

---

## 4. Bugs Discovered & Targeted Improvements Implemented

During evaluation and benchmarking, five key reliability gaps were identified and resolved:

### 1. FTS5 Natural Language Query Failure (AND vs OR Matching)
- **Problem**: When a user asked *"Which databases did we shortlist earlier for our backend?"*, FTS5 concatenated all 9 tokens with implicit `AND`. If the stored message was `"We shortlisted PostgreSQL and MongoDB"`, the search failed completely because conversational words were missing.
- **Fix**: Updated [`src/memory/messages.ts`](../src/memory/messages.ts) to join tokens with `OR` (`"databases"* OR "shortlist"*`). SQLite FTS5 now ranks results using BM25 relevance score (`ORDER BY rank`), matching documents containing subsets of significant terms.

### 2. Full-Sentence `LIKE` Mismatch in Memory Search
- **Problem**: `searchMemories(query)` in [`src/memory/memories.ts`](../src/memory/memories.ts) executed `WHERE subject LIKE '%query%' OR content LIKE '%query%'`. When given a complete sentence, it required the verbatim sentence to exist in the memory text.
- **Fix**: Filtered out conversational stop words (`"what"`, `"which"`, `"did"`, `"we"`, `"our"`) and generated multi-keyword `OR (subject LIKE ? OR content LIKE ?)` SQL clauses across significant keywords.

### 3. Date-Specific Retrieval Gap
- **Problem**: Message timestamps (`created_at`) were stored as ISO strings, but the FTS5 virtual table only indexed `content`. Date queries like *"What happened on November 5, 2026?"* could not retrieve messages from older dates.
- **Fix**:
  1. Added `getMessagesByDate` in [`src/memory/messages.ts`](../src/memory/messages.ts) querying `WHERE conversation_id = ? AND date(created_at) = date(?)`.
  2. Updated [`src/agent/context.ts`](../src/agent/context.ts) to detect ISO and text dates (`November 5, 2026`) and automatically fetch historical messages from that calendar day.

### 4. Temporal Grounding in System Prompt
- **Problem**: The system prompt lacked awareness of the current date and year, causing Gemini to struggle with relative temporal references (*"yesterday"*, *"last month"*, *"current pricing"*).
- **Fix**: Updated [`src/agent/chat.ts`](../src/agent/chat.ts) to inject `Current Date: YYYY-MM-DD` dynamically into the system instructions.

### 5. Cross-Conversation Memory Attribution
- **Problem**: Context retrieval previously discarded all memories from other conversation IDs.
- **Fix**: Updated [`src/agent/context.ts`](../src/agent/context.ts) to include relevant keyword-matched memories from earlier conversations, explicitly labeling them `- [fact] [from earlier conversation] Subject: Content` so Gemini can reference earlier decisions while preserving conversation boundaries.

---

## 5. Remaining Architectural Limitations

1. **No Contradiction Resolution / Memory Expiry**:
   - If a user states *"Our budget is $50,000"* and later states *"Our budget increased to $80,000"*, both memories remain active in SQLite. Recall currently relies on the LLM to observe timestamp differences in the prompt rather than maintaining a structured `superseded_by` pointer.
2. **Effective Date of Real-World Changes**:
   - Web search snippets report indexing dates (`retrieved_at` and `published_at`), but cannot confirm the exact legal or operational effective date of a pricing change unless explicitly written in the snippet copy.
3. **Snippet-Only Research**:
   - Tavily returns concise snippets (up to 5 results). Deep document parsing (e.g. multi-page PDFs or deep web crawls) is not supported.

---

## 6. How to Reproduce the Evaluation

### Run Full Automated Test Suite (36 Tests)
```bash
npm test
```

### Run Dedicated Phase 5 Benchmark Runner
```bash
npm run evaluate
```

### Run Typecheck & Production Build
```bash
npm run typecheck
npm run build
```

