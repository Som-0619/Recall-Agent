import { Conversation, Message, Memory, ChatResult, MemoryType, HealthStatus } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || '';

class ApiError extends Error {
  status: number;
  details?: any;

  constructor(message: string, status: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message = data?.error || `HTTP error ${response.status}: ${response.statusText}`;
      throw new ApiError(message, response.status, data?.details);
    }

    return data as T;
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(error.message || 'Network request failed', 0);
  }
}

export const api = {
  // Health
  async checkHealth(): Promise<HealthStatus> {
    const start = performance.now();
    try {
      const res = await request<{ status: string; app: string }>('/health');
      const latency = Math.round(performance.now() - start);
      return { status: res.status === 'ok' ? 'ok' : 'error', app: res.app, latency };
    } catch {
      return { status: 'offline' };
    }
  },

  // Conversations
  async listConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('/conversations');
  },

  async createConversation(title: string): Promise<Conversation> {
    return request<Conversation>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  async getConversation(id: string): Promise<Conversation> {
    return request<Conversation>(`/conversations/${id}`);
  },

  async updateConversation(id: string, title: string): Promise<Conversation> {
    return request<Conversation>(`/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title }),
    });
  },

  async deleteConversation(id: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  // Messages
  async getMessages(conversationId: string, limit?: number): Promise<Message[]> {
    const query = limit ? `?limit=${limit}` : '';
    return request<Message[]>(`/conversations/${conversationId}/messages${query}`);
  },

  // Chat (Sends message, invokes Gemini & Tavily, extracts memories)
  async chat(conversationId: string, message: string): Promise<ChatResult> {
    return request<ChatResult>(`/conversations/${conversationId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  },

  // Memories
  async getMemories(conversationId: string): Promise<Memory[]> {
    return request<Memory[]>(`/conversations/${conversationId}/memories`);
  },

  async saveMemory(
    conversationId: string,
    data: {
      type: MemoryType;
      subject: string;
      content: string;
      source_message_id?: string | null;
    }
  ): Promise<Memory> {
    return request<Memory>(`/conversations/${conversationId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Search
  async searchMessages(q: string, limit = 20): Promise<(Message & { rank: number })[]> {
    const params = new URLSearchParams({ q, limit: limit.toString() });
    return request<(Message & { rank: number })[]>(`/search?${params.toString()}`);
  },
};

