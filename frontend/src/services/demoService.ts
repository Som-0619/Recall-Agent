import { Conversation, Message, Memory, ChatResult, MemoryType, SearchResult } from '../types';

interface DemoStore {
  conversations: Conversation[];
  messages: Record<string, Message[]>;
  memories: Record<string, Memory[]>;
}

const STORAGE_KEY = 'recall_demo_store_v1';

const INITIAL_CONVERSATION_1_ID = 'demo-conv-1-arch';
const INITIAL_CONVERSATION_2_ID = 'demo-conv-2-research';

function getInitialStore(): DemoStore {
  const conv1: Conversation = {
    id: INITIAL_CONVERSATION_1_ID,
    title: 'E-Commerce Architecture Decisions',
    created_at: '2026-11-10T14:30:00.000Z',
    updated_at: '2026-11-10T14:35:00.000Z',
  };

  const conv2: Conversation = {
    id: INITIAL_CONVERSATION_2_ID,
    title: 'Fastify v5 Release Research',
    created_at: '2026-11-11T10:15:00.000Z',
    updated_at: '2026-11-11T10:16:00.000Z',
  };

  const conv1Messages: Message[] = [
    {
      id: 'demo-msg-1',
      conversation_id: INITIAL_CONVERSATION_1_ID,
      role: 'user',
      content: 'For our checkout service, we decided to use PostgreSQL and Stripe. Strict constraint: no third-party tracking scripts on checkout.',
      created_at: '2026-11-10T14:31:00.000Z',
    },
    {
      id: 'demo-msg-2',
      conversation_id: INITIAL_CONVERSATION_1_ID,
      role: 'assistant',
      content: '[SIMULATED RESPONSE] Understood! I have recorded your architecture choices in persistent memory:\n\n• **Primary Database**: PostgreSQL\n• **Payment Provider**: Stripe\n• **Constraint**: No third-party tracking scripts permitted on checkout pages.\n\nI will remember these constraints in future turns.',
      created_at: '2026-11-10T14:31:05.000Z',
      isSimulated: true,
    },
  ];

  const conv2Sources: SearchResult[] = [
    {
      title: 'Fastify v5.0.0 Release Notes',
      url: 'https://github.com/fastify/fastify/releases/tag/v5.0.0',
      content: 'Fastify v5 released with dropping of Node.js 16/18 EOL support, overhauled TypeScript types, and faster routing.',
      published_at: '2024-09-24T10:00:00Z',
      domain: 'github.com',
      retrieved_at: '2026-11-11T10:15:30.000Z',
    },
    {
      title: 'Fastify Official Documentation',
      url: 'https://fastify.dev/docs/latest',
      content: 'Fastify is an extremely fast and low-overhead web framework for Node.js.',
      published_at: null,
      domain: 'fastify.dev',
      retrieved_at: '2026-11-11T10:15:30.000Z',
    },
  ];

  const conv2Messages: Message[] = [
    {
      id: 'demo-msg-3',
      conversation_id: INITIAL_CONVERSATION_2_ID,
      role: 'user',
      content: 'What is the latest stable version of Fastify and what are the key updates?',
      created_at: '2026-11-11T10:15:00.000Z',
    },
    {
      id: 'demo-msg-4',
      conversation_id: INITIAL_CONVERSATION_2_ID,
      role: 'assistant',
      content: '[SIMULATED RESEARCH] Fastify v5 is the current stable major release [1]. Key enhancements include dropping support for obsolete Node.js runtimes, improved schema validation performance, and streamlined plugin encapsulation [2].',
      created_at: '2026-11-11T10:15:32.000Z',
      isSimulated: true,
      sources: conv2Sources,
    },
  ];

  const conv1Memories: Memory[] = [
    {
      id: 'demo-mem-1',
      conversation_id: INITIAL_CONVERSATION_1_ID,
      type: 'decision',
      subject: 'database',
      content: 'PostgreSQL chosen for primary relational storage in checkout',
      source_message_id: 'demo-msg-1',
      created_at: '2026-11-10T14:31:02.000Z',
    },
    {
      id: 'demo-mem-2',
      conversation_id: INITIAL_CONVERSATION_1_ID,
      type: 'decision',
      subject: 'payments',
      content: 'Stripe selected as the payment gateway provider',
      source_message_id: 'demo-msg-1',
      created_at: '2026-11-10T14:31:02.000Z',
    },
    {
      id: 'demo-mem-3',
      conversation_id: INITIAL_CONVERSATION_1_ID,
      type: 'constraint',
      subject: 'privacy & compliance',
      content: 'Strict constraint: No third-party tracking scripts permitted on checkout',
      source_message_id: 'demo-msg-1',
      created_at: '2026-11-10T14:31:02.000Z',
    },
  ];

  return {
    conversations: [conv2, conv1],
    messages: {
      [INITIAL_CONVERSATION_1_ID]: conv1Messages,
      [INITIAL_CONVERSATION_2_ID]: conv2Messages,
    },
    memories: {
      [INITIAL_CONVERSATION_1_ID]: conv1Memories,
      [INITIAL_CONVERSATION_2_ID]: [],
    },
  };
}

function loadStore(): DemoStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getInitialStore();
  }
}

function saveStore(store: DemoStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.error('Failed to save demo store to localStorage', err);
  }
}

export const demoService = {
  reset(): void {
    const fresh = getInitialStore();
    saveStore(fresh);
  },

  listConversations(): Conversation[] {
    const store = loadStore();
    return store.conversations;
  },

  createConversation(title: string): Conversation {
    const store = loadStore();
    const newConv: Conversation = {
      id: `demo-conv-${Date.now()}`,
      title: title.trim() || 'New Chat (Demo)',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.conversations.unshift(newConv);
    store.messages[newConv.id] = [];
    store.memories[newConv.id] = [];
    saveStore(store);
    return newConv;
  },

  updateConversation(id: string, title: string): Conversation {
    const store = loadStore();
    const conv = store.conversations.find((c) => c.id === id);
    if (!conv) throw new Error('Conversation not found');
    conv.title = title;
    conv.updated_at = new Date().toISOString();
    saveStore(store);
    return conv;
  },

  deleteConversation(id: string): void {
    const store = loadStore();
    store.conversations = store.conversations.filter((c) => c.id !== id);
    delete store.messages[id];
    delete store.memories[id];
    saveStore(store);
  },

  getMessages(conversationId: string): Message[] {
    const store = loadStore();
    return store.messages[conversationId] || [];
  },

  getMemories(conversationId: string): Memory[] {
    const store = loadStore();
    return store.memories[conversationId] || [];
  },

  saveMemory(
    conversationId: string,
    data: { type: MemoryType; subject: string; content: string; source_message_id?: string | null }
  ): Memory {
    const store = loadStore();
    const newMem: Memory = {
      id: `demo-mem-${Date.now()}`,
      conversation_id: conversationId,
      type: data.type,
      subject: data.subject,
      content: data.content,
      source_message_id: data.source_message_id || null,
      created_at: new Date().toISOString(),
    };
    if (!store.memories[conversationId]) {
      store.memories[conversationId] = [];
    }
    store.memories[conversationId].push(newMem);
    saveStore(store);
    return newMem;
  },

  // Simulated Chat Execution
  async chat(conversationId: string, messageText: string): Promise<ChatResult> {
    // Artificial 500ms delay to feel natural
    await new Promise((r) => setTimeout(r, 600));

    const store = loadStore();
    const userMsgId = `demo-msg-user-${Date.now()}`;
    const assistantMsgId = `demo-msg-asst-${Date.now()}`;
    const now = new Date().toISOString();

    const userMessage: Message = {
      id: userMsgId,
      conversation_id: conversationId,
      role: 'user',
      content: messageText,
      created_at: now,
    };

    if (!store.messages[conversationId]) {
      store.messages[conversationId] = [];
    }
    store.messages[conversationId].push(userMessage);

    const lower = messageText.toLowerCase();

    // Check if this inquiry matches prior demo memories or cross-conversation memories
    const isRecallInquiry =
      lower.includes('database') ||
      lower.includes('payment') ||
      lower.includes('tracking') ||
      lower.includes('shortlist') ||
      lower.includes('stack') ||
      lower.includes('constraint') ||
      lower.includes('decision');

    const isResearchInquiry =
      lower.includes('version') ||
      lower.includes('latest') ||
      lower.includes('price') ||
      lower.includes('release') ||
      lower.includes('search') ||
      lower.includes('current') ||
      lower.includes('news');

    const isDecisionStatement =
      lower.includes('we decided') ||
      lower.includes('we chose') ||
      lower.includes('our rule') ||
      lower.includes('prefer') ||
      lower.includes('must be') ||
      lower.includes('requirement');

    let reply = '';
    let sources: SearchResult[] = [];
    let savedMemoriesCount = 0;

    if (isRecallInquiry) {
      // Memory recall response
      reply =
        `[SIMULATED MEMORY RECALL] From our stored architectural memories:\n\n` +
        `• **Database**: PostgreSQL was chosen for primary storage.\n` +
        `• **Payment**: Stripe was selected for checkout.\n` +
        `• **Constraint**: Zero third-party tracking scripts permitted on checkout.\n\n` +
        `*(This demonstrates Recall's ability to recall structured memories across conversational turns without external re-prompting.)*`;
    } else if (isResearchInquiry) {
      // Simulated web research with citations
      reply =
        `[SIMULATED RESEARCH] According to current documentation and release logs [1], modern release versions include critical security patches, performance optimisations, and overhauled TypeScript declarations [2].\n\n` +
        `*(Note: This is a clearly labelled simulated web research result with verifiable source references.)*`;

      sources = [
        {
          title: 'Official Technical Release Index',
          url: 'https://fastify.dev/docs/latest/Guides/Migration-Guide-V5',
          content: 'Overview of migration changes, breaking deprecations, and performance benchmarks.',
          published_at: '2024-10-01T08:00:00Z',
          domain: 'fastify.dev',
          retrieved_at: new Date().toISOString(),
        },
        {
          title: 'GitHub Core Repository Releases',
          url: 'https://github.com/fastify/fastify/releases',
          content: 'Changelog records, asset bundles, and contributor notes for major releases.',
          published_at: '2024-09-24T12:00:00Z',
          domain: 'github.com',
          retrieved_at: new Date().toISOString(),
        },
      ];
    } else if (isDecisionStatement) {
      // Decision extracted into memory
      reply =
        `[SIMULATED RESPONSE] Got it. I have noted this decision and extracted it into the conversation memory panel on the right.\n\n` +
        `You can open the **Memory Panel** above to inspect the newly persisted entity.`;

      // Extract a simulated memory
      const memType: MemoryType = lower.includes('rule') || lower.includes('must') ? 'constraint' : 'decision';
      const extractedMem: Memory = {
        id: `demo-mem-${Date.now()}`,
        conversation_id: conversationId,
        type: memType,
        subject: 'architecture',
        content: messageText.replace(/^(we decided to|we chose to|our rule is)\s*/i, '').trim(),
        source_message_id: userMsgId,
        created_at: now,
      };

      if (!store.memories[conversationId]) {
        store.memories[conversationId] = [];
      }
      store.memories[conversationId].push(extractedMem);
      savedMemoriesCount = 1;
    } else {
      reply =
        `[SIMULATED RESPONSE] This is a simulated response in **Recall Demo Mode**.\n\n` +
        `In Live Backend Mode with Google Gemini credentials, Recall dynamically reasons over your dialogue, queries SQLite FTS5 for historical relevance, invokes Tavily for live search grounding, and persists structured memories.\n\n` +
        `Try asking:\n` +
        `1. *"What database and payment provider did we choose?"* (Tests memory recall)\n` +
        `2. *"What is the latest version of Fastify?"* (Tests simulated web research with citations)\n` +
        `3. *"We decided to use Redis for rate limiting."* (Tests dynamic memory extraction)`;
    }

    const assistantMessage: Message = {
      id: assistantMsgId,
      conversation_id: conversationId,
      role: 'assistant',
      content: reply,
      created_at: new Date().toISOString(),
      sources,
      isSimulated: true,
    };

    store.messages[conversationId].push(assistantMessage);

    // Update conversation updated_at and preview title if needed
    const conv = store.conversations.find((c) => c.id === conversationId);
    if (conv) {
      conv.updated_at = now;
      if (store.messages[conversationId].length === 2 && conv.title.startsWith('New Chat')) {
        conv.title = messageText.slice(0, 30) + (messageText.length > 30 ? '...' : '');
      }
    }

    saveStore(store);

    return {
      conversation_id: conversationId,
      user_message_id: userMsgId,
      reply,
      saved_memories: savedMemoriesCount,
      sources,
      isSimulated: true,
    };
  },
};

