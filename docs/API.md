# Recall Agent — REST API Reference

This document provides a complete specification of all HTTP endpoints provided by Recall.

- **Base URL**: `http://localhost:3000`
- **Default Port**: `3000` (configurable via `PORT` in `.env`)
- **Content-Type**: `application/json`

---

## Table of Contents
1. [System Endpoints](#1-system-endpoints)
   - [GET /health](#get-health)
2. [Conversation Endpoints](#2-conversation-endpoints)
   - [POST /conversations](#post-conversations)
   - [GET /conversations](#get-conversations)
   - [GET /conversations/:id](#get-conversationsid)
   - [PATCH /conversations/:id](#patch-conversationsid)
   - [DELETE /conversations/:id](#delete-conversationsid)
3. [Message Endpoints](#3-message-endpoints)
   - [POST /conversations/:id/messages](#post-conversationsidmessages)
   - [GET /conversations/:id/messages](#get-conversationsidmessages)
4. [Memory Endpoints](#4-memory-endpoints)
   - [POST /conversations/:id/memories](#post-conversationsidmemories)
   - [GET /conversations/:id/memories](#get-conversationsidmemories)
5. [Search Endpoints](#5-search-endpoints)
   - [GET /search](#get-search)
6. [Chat & Research Endpoints](#6-chat--research-endpoints)
   - [POST /conversations/:id/chat](#post-conversationsidchat)
7. [Standard Error Responses](#7-standard-error-responses)

---

## 1. System Endpoints

### GET /health

Returns the operational status and application name. Used by health checkers and load balancers.

- **Method**: `GET`
- **Path**: `/health`
- **Authentication**: None

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
{
  "status": "ok",
  "app": "Recall"
}
```

#### Example Request
```bash
curl -X GET http://localhost:3000/health
```

---

## 2. Conversation Endpoints

### POST /conversations

Creates a new conversation thread.

- **Method**: `POST`
- **Path**: `/conversations`

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | Yes | Title of the conversation (non-empty) |

```json
{
  "title": "Database Architecture Discussion"
}
```

#### Success Response
- **Status Code**: `201 Created`
- **Body**:
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Database Architecture Discussion",
  "created_at": "2026-11-11T10:00:00.000Z",
  "updated_at": "2026-11-11T10:00:00.000Z"
}
```

#### Example Request
```bash
curl -X POST http://localhost:3000/conversations \
  -H "Content-Type: application/json" \
  -d '{"title": "Database Architecture Discussion"}'
```

---

### GET /conversations

Lists all conversation threads ordered by most recently updated.

- **Method**: `GET`
- **Path**: `/conversations`

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
[
  {
    "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "title": "Database Architecture Discussion",
    "created_at": "2026-11-11T10:00:00.000Z",
    "updated_at": "2026-11-11T10:15:00.000Z"
  }
]
```

#### Example Request
```bash
curl -X GET http://localhost:3000/conversations
```

---

### GET /conversations/:id

Retrieves metadata for a specific conversation by its UUID.

- **Method**: `GET`
- **Path**: `/conversations/:id`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "Database Architecture Discussion",
  "created_at": "2026-11-11T10:00:00.000Z",
  "updated_at": "2026-11-11T10:15:00.000Z"
}
```

#### Error Response
- **Status Code**: `404 Not Found`
```json
{
  "error": "Conversation not found"
}
```

#### Example Request
```bash
curl -X GET http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

---

### PATCH /conversations/:id

Updates the title of an existing conversation.

- **Method**: `PATCH`
- **Path**: `/conversations/:id`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `title` | `string` | Yes | Updated non-empty title string |

```json
{
  "title": "PostgreSQL Migration Plan"
}
```

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
{
  "id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "title": "PostgreSQL Migration Plan",
  "created_at": "2026-11-11T10:00:00.000Z",
  "updated_at": "2026-11-11T10:20:00.000Z"
}
```

#### Example Request
```bash
curl -X PATCH http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479 \
  -H "Content-Type: application/json" \
  -d '{"title": "PostgreSQL Migration Plan"}'
```

---

### DELETE /conversations/:id

Deletes a conversation and cascade-deletes all associated messages, FTS5 indexes, and structured memories.

- **Method**: `DELETE`
- **Path**: `/conversations/:id`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
{
  "message": "Conversation deleted successfully"
}
```

#### Error Response
- **Status Code**: `404 Not Found`
```json
{
  "error": "Conversation not found"
}
```

#### Example Request
```bash
curl -X DELETE http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479
```

---

## 3. Message Endpoints

### POST /conversations/:id/messages

Saves a raw message directly into a conversation without calling the LLM.

- **Method**: `POST`
- **Path**: `/conversations/:id/messages`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Request Body
| Field | Type | Required | Values / Description |
| :--- | :--- | :---: | :--- |
| `role` | `string` | Yes | `"user"` or `"assistant"` |
| `content` | `string` | Yes | Message text content (non-empty) |

```json
{
  "role": "user",
  "content": "We need to ensure all APIs comply with HIPAA."
}
```

#### Success Response
- **Status Code**: `201 Created`
- **Body**:
```json
{
  "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "role": "user",
  "content": "We need to ensure all APIs comply with HIPAA.",
  "created_at": "2026-11-11T10:05:00.000Z"
}
```

#### Example Request
```bash
curl -X POST http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479/messages \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "We need to ensure all APIs comply with HIPAA."}'
```

---

### GET /conversations/:id/messages

Retrieves messages from a conversation in chronological order (`ASC`), with `rowid` tie-breaking.

- **Method**: `GET`
- **Path**: `/conversations/:id/messages`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `limit` | `integer` | No | None (all) | If set, returns only the most recent N messages in chronological order |

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
[
  {
    "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "role": "user",
    "content": "We need to ensure all APIs comply with HIPAA.",
    "created_at": "2026-11-11T10:05:00.000Z"
  }
]
```

#### Example Request
```bash
curl -X GET "http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479/messages?limit=10"
```

---

## 4. Memory Endpoints

### POST /conversations/:id/memories

Manually creates a structured memory associated with a conversation.

- **Method**: `POST`
- **Path**: `/conversations/:id/memories`

#### Request Body
| Field | Type | Required | Values / Description |
| :--- | :--- | :---: | :--- |
| `type` | `string` | Yes | `"fact"`, `"decision"`, `"preference"`, or `"constraint"` |
| `subject` | `string` | Yes | High-level topic or entity (e.g. `"compliance"`, `"database"`) |
| `content` | `string` | Yes | Full statement or decision |
| `source_message_id` | `string` | No | UUID of the originating message |

```json
{
  "type": "constraint",
  "subject": "compliance",
  "content": "All APIs must be strictly HIPAA-compliant",
  "source_message_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d"
}
```

#### Success Response
- **Status Code**: `201 Created`
- **Body**:
```json
{
  "id": "mem-1234-5678-90ab",
  "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "type": "constraint",
  "subject": "compliance",
  "content": "All APIs must be strictly HIPAA-compliant",
  "source_message_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  "created_at": "2026-11-11T10:06:00.000Z"
}
```

#### Example Request
```bash
curl -X POST http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479/memories \
  -H "Content-Type: application/json" \
  -d '{
    "type": "constraint",
    "subject": "compliance",
    "content": "All APIs must be strictly HIPAA-compliant"
  }'
```

---

### GET /conversations/:id/memories

Retrieves all structured memories stored for a conversation.

- **Method**: `GET`
- **Path**: `/conversations/:id/memories`

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
[
  {
    "id": "mem-1234-5678-90ab",
    "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "type": "constraint",
    "subject": "compliance",
    "content": "All APIs must be strictly HIPAA-compliant",
    "source_message_id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "created_at": "2026-11-11T10:06:00.000Z"
  }
]
```

#### Example Request
```bash
curl -X GET http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479/memories
```

---

## 5. Search Endpoints

### GET /search

Performs full-text search across all stored messages across all conversations using SQLite FTS5 with BM25 ranking.

- **Method**: `GET`
- **Path**: `/search`

#### Query Parameters
| Parameter | Type | Required | Default | Description |
| :--- | :--- | :---: | :---: | :--- |
| `q` | `string` | No | `""` | Search keyword or query string |
| `limit` | `integer` | No | `20` | Maximum results to return |

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
[
  {
    "id": "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "role": "user",
    "content": "We need to ensure all APIs comply with HIPAA.",
    "created_at": "2026-11-11T10:05:00.000Z",
    "rank": -1.452
  }
]
```

#### Example Request
```bash
curl -X GET "http://localhost:3000/search?q=HIPAA&limit=5"
```

---

## 6. Chat & Research Endpoints

### POST /conversations/:id/chat

Primary conversational endpoint. Orchestrates context assembly, Gemini LLM reasoning, bounded Tavily web research, citation generation, response persistence, and asynchronous memory extraction.

- **Method**: `POST`
- **Path**: `/conversations/:id/chat`

#### URL Parameters
| Parameter | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Conversation UUID |

#### Request Body
| Field | Type | Required | Description |
| :--- | :--- | :---: | :--- |
| `message` | `string` | Yes | Non-empty user prompt or instruction |

```json
{
  "message": "What is our compliance requirement, and what are the latest HIPAA cloud audit guidelines?"
}
```

#### Response Fields Description

| Field | Type | Description |
| :--- | :--- | :--- |
| `conversation_id` | `string` | The UUID of the conversation thread |
| `user_message_id` | `string` | The UUID assigned to the persisted user message in SQLite |
| `reply` | `string` | The synthesized assistant response, containing bracketed citations (e.g., `[1]`, `[2]`) when web research was conducted |
| `saved_memories` | `integer` | The count of new structured memories extracted and persisted from this turn |
| `sources` | `SearchResult[]` | Array of source citations supporting facts in `reply`. Empty array if no web search occurred |

##### `sources` Item Schema (`SearchResult`):
| Subfield | Type | Description |
| :--- | :--- | :--- |
| `title` | `string` | Title of the web page or document |
| `url` | `string` | Validated HTTP or HTTPS web URL |
| `content` | `string` | Extracted content snippet used by the LLM for research grounding |
| `published_at` | `string \| null`| ISO 8601 publication date string, or `null` if not provided by source |
| `domain` | `string` | Cleaned domain name (e.g. `hhs.gov`, `github.com`) |
| `retrieved_at` | `string` | ISO 8601 timestamp when Tavily executed the retrieval |

#### Success Response
- **Status Code**: `200 OK`
- **Body**:
```json
{
  "conversation_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  "user_message_id": "m-user-991",
  "reply": "According to our prior discussion, all of our APIs must be strictly HIPAA-compliant. The latest HHS guidelines emphasize automated access logging and cryptographic key rotation for cloud environments [1].",
  "saved_memories": 1,
  "sources": [
    {
      "title": "HHS Health Information Privacy Updates",
      "url": "https://www.hhs.gov/hipaa/for-professionals/security/guidance/index.html",
      "content": "Official guidance on HIPAA Security Rule compliance in cloud service environments...",
      "published_at": "2024-05-15T00:00:00Z",
      "domain": "hhs.gov",
      "retrieved_at": "2026-11-11T10:10:00.000Z"
    }
  ]
}
```

#### Example Request
```bash
curl -X POST http://localhost:3000/conversations/f47ac10b-58cc-4372-a567-0e02b2c3d479/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is our compliance requirement, and what are the latest HIPAA cloud audit guidelines?"}'
```

---

## 7. Standard Error Responses

Recall returns standard RFC 7807-like JSON error responses for invalid inputs, missing resources, and server faults.

### 400 Bad Request
Returned when request parameters or JSON bodies fail Zod validation.

```json
{
  "error": "Invalid request body",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "type": "string",
      "inclusive": true,
      "exact": false,
      "message": "Message cannot be empty",
      "path": ["message"]
    }
  ]
}
```

### 404 Not Found
Returned when referencing a non-existent conversation ID.

```json
{
  "error": "Conversation not found"
}
```

### 500 Internal Server Error
Returned when an unhandled exception or unrecoverable external API error occurs.

```json
{
  "error": "Failed to generate chat response"
}
```

