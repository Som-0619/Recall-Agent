# Recall Agent — Frontend Client

A clean, modern React + TypeScript frontend for the Recall conversational memory and web research agent.

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Bundler & Dev Server**: Vite
- **Styling**: Tailwind CSS with dark mode support
- **Icons**: Lucide React (`lucide-react`)
- **API Communication**: Native `fetch` with Vite dev proxy to Fastify (`:3000`)

---

## Features

1. **Responsive Chat Interface**:
   - Left sidebar with Recall branding, conversation history, search filter, and New Chat button.
   - Main chat workspace with welcome hero screen and starter prompt cards.
   - Auto-expanding message composer with keyboard shortcuts (`Enter` to send, `Shift+Enter` for newline).
   - In-text citation badges (`[1]`, `[2]`) linked interactively to verified source cards.

2. **Conversation & Message Management**:
   - Create, list, open, rename, and delete conversation threads.
   - Messages and replies persisted into SQLite via Fastify backend endpoints.

3. **Collapsible Memory Panel**:
   - Interactive slide-out drawer displaying structured memories (`fact`, `decision`, `preference`, `constraint`).
   - Filter by type, search memories by keyword, view source message reference IDs, and add manual memories.

4. **Zero-Credentials Demo Mode**:
   - Preview and test conversational memory and web research without Gemini or Tavily API keys.
   - Clearly marked simulated assistant responses (`[SIMULATED RESPONSE]`, `[SIMULATED RESEARCH]`, `[SIMULATED MEMORY RECALL]`).
   - Mock citations and verified sources with real-time memory extraction demonstration.
   - Demo data stored separately in `localStorage` with a 1-click "Reset Demo Data" option.

5. **Backend Health & Diagnostics**:
   - Automatic ping to `GET /health` with real-time latency and connectivity indicator.
   - Graceful fallback with one-click switch to Demo Mode if backend is unreachable or missing API keys.

---

## Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run Development Server
```bash
npm run dev
```
The frontend will start on [http://localhost:5173](http://localhost:5173).

During development, Vite automatically proxies API requests (`/conversations`, `/search`, `/health`) to `http://localhost:3000`.

### 3. Build for Production
```bash
npm run build
```
Build output is generated inside `frontend/dist/`.

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `VITE_API_URL` | `""` (proxied by Vite) | Optional custom backend URL (e.g. `http://localhost:3000`) |

