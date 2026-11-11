# Recall Agent — Live Demonstration Script (5–7 Minutes)

This script is designed for a live technical demonstration or presentation of **Recall**. It walks through 5 concrete scenarios showcasing deterministic memory, native LLM tool calling, internet research grounding, cross-conversation recall, and honest uncertainty handling.

---

## Preparation Checklist

1. Make sure `.env` is configured with valid `GEMINI_API_KEY` and `TAVILY_API_KEY`.
2. Start the server in a terminal window:
   ```bash
   npm run dev
   ```
3. Open a second terminal window for running the `curl` commands below.
4. Set an environment variable for the base URL:
   ```bash
   BASE_URL="http://localhost:3000"
   ```

---

## Demo Schedule Overview

| Step | Focus Area | Description | Time |
| :---: | :--- | :--- | :---: |
| **Demo 1** | System & Health | Verify server startup and Fastify health check | ~30 sec |
| **Demo 2** | Memory & Extraction | Store technical decisions, verify memory extraction, and recall | ~1.5 min |
| **Demo 3** | Web Research & Citations | Current real-world inquiry, Gemini tool calling, and source grounding | ~1.5 min |
| **Demo 4** | Cross-Conversation Recall | Thread isolation with historical decision discovery | ~1.5 min |
| **Demo 5** | Uncertainty & Degradation | Handling obscure topics or unverified claims without hallucination | ~1 min |
| **Total** | | | **~6.0 min** |

---

## Demo 1: System Health & Server Verification (~30 sec)

### Objective
Show that the Fastify server is running, healthy, and ready to accept requests.

### Command
```bash
curl -X GET "$BASE_URL/health"
```

### Expected Response
```json
{
  "status": "ok",
  "app": "Recall"
}
```

### What to Highlight
- The server starts instantly because there are no heavy external orchestration engines or remote vector database connections.
- It uses Fastify and TypeScript with native JSON serialization for minimal latency.

---

## Demo 2: In-Conversation Memory & Structured Extraction (~1.5 min)

### Objective
Create a new conversation, inform Recall of an architectural decision, observe automated memory extraction, and verify immediate conversational recall.

### Step 2A: Create Conversation
```bash
CONV_1=$(curl -s -X POST "$BASE_URL/conversations" \
  -H "Content-Type: application/json" \
  -d '{"title": "E-Commerce Architecture"}' | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Created Conversation 1 ID: $CONV_1"
```

### Step 2B: State Architectural Decision
```bash
curl -X POST "$BASE_URL/conversations/$CONV_1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "For our e-commerce checkout, we decided to use PostgreSQL and Stripe, with a strict rule: no third-party tracking scripts."}'
```

#### Expected Response Highlights:
- `saved_memories: 1` (or more)
- `sources: []` (no web search needed; it's a statement of user constraints)
- Fast response acknowledging the choices.

### Step 2C: Verify Extracted Memories
Check the database to verify the structured memory was saved without writing manual boilerplate:
```bash
curl -s -X GET "$BASE_URL/conversations/$CONV_1/memories"
```
*Observe*: A structured record with `type: "decision"` or `"constraint"`, `subject: "checkout"`, referencing the original message ID.

### Step 2D: Recall Within Conversation
```bash
curl -X POST "$BASE_URL/conversations/$CONV_1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What database and payment provider did we choose for checkout?"}'
```

#### What to Highlight
- Recall synthesizes the answer directly from its SQLite memory context.
- Zero web search calls were made, saving tokens and network latency.

---

## Demo 3: Autonomous Web Research & Verifiable Citations (~1.5 min)

### Objective
Ask a question that requires live internet research, observe Gemini autonomously calling the `web_search` tool, and inspect the grounded citation output.

### Command
```bash
curl -X POST "$BASE_URL/conversations/$CONV_1/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the latest stable version of Fastify, and what were the main breaking changes in that major release?"}'
```

### Expected Response Highlights:
```json
{
  "conversation_id": "...",
  "reply": "The latest major release of Fastify is v5 [1]. Key breaking changes include dropping support for obsolete Node.js versions, updated error handling schemas, and enhanced route prefix handling [2].",
  "saved_memories": 0,
  "sources": [
    {
      "title": "Fastify v5.0.0 Release Notes",
      "url": "https://github.com/fastify/fastify/releases/tag/v5.0.0",
      "domain": "github.com",
      "published_at": "2024-09-24T10:00:00Z",
      "retrieved_at": "2026-11-11T..."
    }
  ]
}
```

### What to Highlight
- **Autonomous Tool Execution**: The model chose to call the tool because it recognized that library versions require current ground truth.
- **In-Text Citations**: The model automatically places `[1]` and `[2]` next to specific claims.
- **Structured Metadata**: The `sources` array contains exact URLs, domains, and ISO timestamps, allowing frontend clients to render interactive footnotes.
- **Loop Bounding**: Explain that the tool loop is capped at a strict maximum of 3 searches with duplicate suppression.

---

## Demo 4: Cross-Conversation Memory Recall (~1.5 min)

### Objective
Show that when the user creates a brand new conversation thread weeks or months later, Recall can still pull relevant decisions from older threads without contaminating conversation boundaries.

### Step 4A: Create Conversation 2
```bash
CONV_2=$(curl -s -X POST "$BASE_URL/conversations" \
  -H "Content-Type: application/json" \
  -d '{"title": "Analytics Integration"}' | grep -o '"id":"[^"]*' | cut -d'"' -f4)

echo "Created Conversation 2 ID: $CONV_2"
```

### Step 4B: Inquire in the New Conversation
```bash
curl -X POST "$BASE_URL/conversations/$CONV_2/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "Can we install Google Tag Manager or Facebook Pixel on our checkout page?"}'
```

### Expected Response Highlights:
- Recall responds: *"No, because earlier you established a strict constraint that no third-party tracking scripts are allowed on the checkout page."*
- In the backend context, the memory was retrieved using keyword matching across threads and labeled `[from earlier conversation]`.

### What to Highlight
- Solves **context amnesia** without cramming entire previous chat logs into the prompt.
- Retains thread isolation: Conversation 2 only receives relevant extracted facts, keeping token usage minimal.

---

## Demo 5: Graceful Degradation & Honest Uncertainty (~1 min)

### Objective
Demonstrate how Recall behaves when confronted with non-existent or unverified information, proving it does not hallucinate.

### Command
```bash
curl -X POST "$BASE_URL/conversations/$CONV_2/chat" \
  -H "Content-Type: application/json" \
  -d '{"message": "What did our security lead decide yesterday regarding quantum cryptography migration?"}'
```

### Expected Response Highlights:
- Recall responds directly and honestly: *"I do not have any record or saved decision regarding quantum cryptography migration or notes from your security lead."*
- It does **not** invent names, fabricate imaginary meeting minutes, or make assumptions.

### What to Highlight
- System prompt rule #4 explicitly instructs: *"Never invent prior discussions. If historical context is missing, acknowledge that you do not have that prior record."*
- If Tavily returns no search results or external search fails, the agent admits the lack of verification rather than hallucinating outdated knowledge as fresh.

---

## Conclusion & Wrap-Up (30 sec)

Summarize the four key technical takeaways:
1. **Zero Vector Overhead**: High-precision memory achieved using SQLite, FTS5 BM25, and structured JSON extraction.
2. **Deterministic Durability**: User messages persist before any network call; system survives LLM downtime.
3. **Autonomous Grounding**: LLM tool calling with strict boundary safety (max 3 calls, duplicate query suppression).
4. **Verifiable Citations**: Every web fact maps to a verified source URL with domain and retrieval metadata.

