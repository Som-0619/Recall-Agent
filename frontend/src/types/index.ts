export type MemoryType = 'fact' | 'decision' | 'preference' | 'constraint';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  published_at: string | null;
  domain: string;
  retrieved_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  sources?: SearchResult[];
  isSimulated?: boolean;
}

export interface Memory {
  id: string;
  conversation_id: string;
  type: MemoryType;
  subject: string;
  content: string;
  source_message_id: string | null;
  created_at: string;
}

export interface ChatResult {
  conversation_id: string;
  user_message_id: string;
  reply: string;
  saved_memories: number;
  sources: SearchResult[];
  isSimulated?: boolean;
}

export type AppMode = 'live' | 'demo';

export interface HealthStatus {
  status: 'ok' | 'error' | 'offline';
  app?: string;
  latency?: number;
}

