export type EvaluationCategory =
  | 'cross_conversation'
  | 'date_recall'
  | 'preference_decision'
  | 'web_research'
  | 'historical_vs_current'
  | 'failure_scenarios';

export interface SetupMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
}

export interface SetupMemory {
  type: 'fact' | 'decision' | 'preference' | 'constraint';
  subject: string;
  content: string;
  createdAt?: string;
}

export interface SetupConversation {
  id?: string;
  title: string;
  createdAt?: string;
  messages: SetupMessage[];
  memories?: SetupMemory[];
}

export interface EvaluationCase {
  id: string;
  category: EvaluationCategory;
  name: string;
  description: string;
  setupConversations: SetupConversation[];
  activeConversationIndex: number;
  userMessage: string;
  expected: {
    searchRequired: boolean;
    expectedKeywords: string[];
    forbiddenKeywords?: string[];
    shouldContainCitations?: boolean;
    expectedMemoryTypes?: string[];
    shouldDiscloseUnverified?: boolean;
    expectFailure?: boolean;
  };
  mockGeminiResponse?: (turn: number, query: string, toolsCalled?: boolean) => {
    text?: string | null;
    functionCalls?: Array<{ name: string; args: any }>;
  };
  mockTavilyResponse?: (query: string) => Array<{
    title: string;
    url: string;
    content: string;
    publishedDate?: string;
  }>;
}

export const evaluationDataset: EvaluationCase[] = [
  // ==========================================
  // Category A: Cross-conversation memory (4 cases)
  // ==========================================
  {
    id: 'A1',
    category: 'cross_conversation',
    name: 'Database Shortlist Across Conversations',
    description: 'User shortlists PostgreSQL and MongoDB in Conv 1, then asks in Conv 2.',
    setupConversations: [
      {
        title: 'Backend Database Evaluation',
        messages: [
          { role: 'user', content: 'We shortlisted PostgreSQL and MongoDB for our backend architecture.' },
          { role: 'assistant', content: 'Understood. PostgreSQL and MongoDB are both strong candidates.' },
        ],
        memories: [
          {
            type: 'decision',
            subject: 'Database shortlist',
            content: 'Shortlisted PostgreSQL and MongoDB for backend.',
          },
        ],
      },
      {
        title: 'Sprint Planning',
        messages: [],
      },
    ],
    activeConversationIndex: 1,
    userMessage: 'Which databases did we shortlist earlier for our backend?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['PostgreSQL', 'MongoDB'],
      forbiddenKeywords: ['MySQL', 'Oracle'],
    },
    mockGeminiResponse: (_turn, _query) => ({
      text: 'Based on our previous discussion, you shortlisted PostgreSQL and MongoDB.',
      functionCalls: [],
    }),
  },
  {
    id: 'A2',
    category: 'cross_conversation',
    name: 'Project Codename in Separate Thread',
    description: 'Secret codename saved in Conv 1, queried in Conv 2.',
    setupConversations: [
      {
        title: 'Project Kickoff',
        messages: [
          { role: 'user', content: 'Our internal project codename is Project Chimera.' },
          { role: 'assistant', content: 'Noted: Project Chimera is the project codename.' },
        ],
        memories: [
          {
            type: 'fact',
            subject: 'Project Codename',
            content: 'Internal project codename is Project Chimera.',
          },
        ],
      },
      {
        title: 'Status Report',
        messages: [],
      },
    ],
    activeConversationIndex: 1,
    userMessage: 'What is our internal project codename?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Chimera'],
    },
    mockGeminiResponse: () => ({
      text: 'Our internal project codename is Project Chimera.',
      functionCalls: [],
    }),
  },
  {
    id: 'A3',
    category: 'cross_conversation',
    name: 'Team Roles Across Conversations',
    description: 'Role assigned in Conv 1, queried in Conv 2.',
    setupConversations: [
      {
        title: 'Staffing',
        messages: [
          { role: 'user', content: 'Alice is lead backend engineer and Bob is frontend lead.' },
          { role: 'assistant', content: 'Recorded team roles for Alice and Bob.' },
        ],
        memories: [
          {
            type: 'fact',
            subject: 'Team Roles',
            content: 'Alice is lead backend engineer, Bob is frontend lead.',
          },
        ],
      },
      {
        title: 'Resource Planning',
        messages: [],
      },
    ],
    activeConversationIndex: 1,
    userMessage: 'Who is our lead backend engineer?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Alice'],
      forbiddenKeywords: ['Bob'],
    },
    mockGeminiResponse: () => ({
      text: 'Alice is our lead backend engineer.',
      functionCalls: [],
    }),
  },
  {
    id: 'A4',
    category: 'cross_conversation',
    name: 'Unrelated Query in New Thread',
    description: 'Asking about something never discussed in any conversation.',
    setupConversations: [
      {
        title: 'Infrastructure',
        messages: [
          { role: 'user', content: 'We deploy using Docker containers on AWS.' },
        ],
      },
      {
        title: 'General Chat',
        messages: [],
      },
    ],
    activeConversationIndex: 1,
    userMessage: 'What is our company mascot?',
    expected: {
      searchRequired: false,
      expectedKeywords: [],
      shouldDiscloseUnverified: true,
    },
    mockGeminiResponse: () => ({
      text: 'I do not have any record of our company mascot in previous conversations.',
      functionCalls: [],
    }),
  },

  // ==========================================
  // Category B: Date-specific recall (4 cases)
  // ==========================================
  {
    id: 'B1',
    category: 'date_recall',
    name: 'Recall Discussion on Specific Calendar Date',
    description: 'Discussions on 2026-11-05 vs 2026-11-07; query specifies 2026-11-05.',
    setupConversations: [
      {
        title: 'Architecture Review',
        messages: [
          {
            role: 'user',
            content: 'On this architecture call, we chose SQLite for local persistence.',
            createdAt: '2026-11-05T14:00:00.000Z',
          },
          {
            role: 'assistant',
            content: 'SQLite chosen for local persistence.',
            createdAt: '2026-11-05T14:00:05.000Z',
          },
          {
            role: 'user',
            content: 'On the later review, we evaluated Redis caching.',
            createdAt: '2026-11-07T10:00:00.000Z',
          },
          {
            role: 'assistant',
            content: 'Redis evaluated for caching.',
            createdAt: '2026-11-07T10:00:05.000Z',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What did we decide on November 5, 2026?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['SQLite'],
      forbiddenKeywords: ['Redis'],
    },
    mockGeminiResponse: () => ({
      text: 'On November 5, 2026, you chose SQLite for local persistence.',
      functionCalls: [],
    }),
  },
  {
    id: 'B2',
    category: 'date_recall',
    name: 'Differentiate Two Events on Consecutive Days',
    description: 'Budget approved on Day 1, Vendor selected on Day 2.',
    setupConversations: [
      {
        title: 'Procurement',
        messages: [
          {
            role: 'user',
            content: 'Approved $25,000 budget for research tooling.',
            createdAt: '2026-10-15T09:00:00.000Z',
          },
          {
            role: 'user',
            content: 'Signed agreement with DataVendor Corp.',
            createdAt: '2026-10-16T11:00:00.000Z',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What happened on October 15, 2026?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['25,000', 'budget'],
      forbiddenKeywords: ['DataVendor'],
    },
    mockGeminiResponse: () => ({
      text: 'On October 15, 2026, you approved a $25,000 budget for research tooling.',
      functionCalls: [],
    }),
  },
  {
    id: 'B3',
    category: 'date_recall',
    name: 'Year Sensitivity (2025 vs 2026)',
    description: 'Events in two distinct years.',
    setupConversations: [
      {
        title: 'Roadmap History',
        messages: [
          {
            role: 'user',
            content: 'In our 2025 annual review, we launched MVP 1.0.',
            createdAt: '2025-12-01T10:00:00.000Z',
          },
          {
            role: 'user',
            content: 'In our 2026 review, we planned version 2.0.',
            createdAt: '2026-12-01T10:00:00.000Z',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What milestone was completed in 2025?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['MVP 1.0'],
      forbiddenKeywords: ['version 2.0'],
    },
    mockGeminiResponse: () => ({
      text: 'In 2025, you launched MVP 1.0.',
      functionCalls: [],
    }),
  },
  {
    id: 'B4',
    category: 'date_recall',
    name: 'Query on Date with No History',
    description: 'Asking about a date on which no conversations occurred.',
    setupConversations: [
      {
        title: 'Project Notes',
        messages: [
          { role: 'user', content: 'Notes from standard check-in.', createdAt: '2026-08-01T10:00:00.000Z' },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What did we discuss on September 15, 2026?',
    expected: {
      searchRequired: false,
      expectedKeywords: [],
      shouldDiscloseUnverified: true,
    },
    mockGeminiResponse: () => ({
      text: 'I do not have any notes or records from September 15, 2026.',
      functionCalls: [],
    }),
  },

  // ==========================================
  // Category C: Preference and decision recall (4 cases)
  // ==========================================
  {
    id: 'C1',
    category: 'preference_decision',
    name: 'Technology Preference Recall',
    description: 'User prefers Python for ML and rejects paid APIs.',
    setupConversations: [
      {
        title: 'Tooling Preferences',
        messages: [
          { role: 'user', content: 'I prefer Python for ML projects, and I do not want to use paid APIs.' },
          { role: 'assistant', content: 'Understood. Noting preference for Python and open-source APIs.' },
        ],
        memories: [
          {
            type: 'preference',
            subject: 'ML Language',
            content: 'Prefers Python for ML projects.',
          },
          {
            type: 'constraint',
            subject: 'API Budget',
            content: 'Does not want to use paid APIs.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What were my technology preferences and constraints?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Python', 'paid API'],
    },
    mockGeminiResponse: () => ({
      text: 'Your saved preferences are: you prefer Python for ML projects and you do not want to use paid APIs.',
      functionCalls: [],
    }),
  },
  {
    id: 'C2',
    category: 'preference_decision',
    name: 'Permanent Constraint vs Temporary Choice',
    description: 'Distinguish HIPAA compliance constraint from temporary test framework.',
    setupConversations: [
      {
        title: 'Compliance & Frameworks',
        messages: [
          { role: 'user', content: 'Our permanent constraint is strict HIPAA compliance for healthcare data.' },
          { role: 'user', content: 'For this afternoon sprint, we are temporarily using Jest.' },
        ],
        memories: [
          {
            type: 'constraint',
            subject: 'Compliance',
            content: 'Permanent constraint: strict HIPAA compliance for healthcare data.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What are our non-negotiable compliance constraints?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['HIPAA'],
      forbiddenKeywords: ['Jest'],
    },
    mockGeminiResponse: () => ({
      text: 'Your non-negotiable compliance constraint is strict HIPAA compliance for healthcare data.',
      functionCalls: [],
    }),
  },
  {
    id: 'C3',
    category: 'preference_decision',
    name: 'Design System Decision Recall',
    description: 'Decided on Tailwind CSS and 8pt grid.',
    setupConversations: [
      {
        title: 'Design Guidelines',
        messages: [
          { role: 'user', content: 'We decided to standardize on Tailwind CSS with an 8pt grid.' },
        ],
        memories: [
          {
            type: 'decision',
            subject: 'Design System',
            content: 'Standardized on Tailwind CSS with an 8pt grid.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What did we decide regarding our design system styling?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Tailwind', '8pt'],
    },
    mockGeminiResponse: () => ({
      text: 'You decided to standardize on Tailwind CSS with an 8pt grid.',
      functionCalls: [],
    }),
  },
  {
    id: 'C4',
    category: 'preference_decision',
    name: 'Code Formatting Preferences',
    description: '2 spaces indentation and single quotes.',
    setupConversations: [
      {
        title: 'Linting Setup',
        messages: [
          { role: 'user', content: 'I prefer 2 spaces indentation and single quotes in TypeScript.' },
        ],
        memories: [
          {
            type: 'preference',
            subject: 'Code Formatting',
            content: 'Prefers 2 spaces indentation and single quotes in TypeScript.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'How do I prefer my code formatted?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['2 spaces', 'single quotes'],
    },
    mockGeminiResponse: () => ({
      text: 'You prefer 2 spaces indentation and single quotes in TypeScript.',
      functionCalls: [],
    }),
  },

  // ==========================================
  // Category D: Current web research (4 cases)
  // ==========================================
  {
    id: 'D1',
    category: 'web_research',
    name: 'Gemini API Updates with Citations',
    description: 'Recent updates require live search and citation brackets.',
    setupConversations: [
      {
        title: 'AI Models Research',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What are the latest Gemini API updates and new models?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['Gemini', 'Flash'],
      shouldContainCitations: true,
    },
    mockTavilyResponse: () => [
      {
        title: 'Google AI Developers - Gemini 2.5',
        url: 'https://ai.google.dev/gemini-api/docs/models/gemini-2.5',
        content: 'Gemini 2.5 Flash is our latest experimental model with improved speed.',
        publishedDate: '2026-02-15',
      },
    ],
    mockGeminiResponse: (turn) => {
      if (turn === 1) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'latest Gemini API updates new models' } }],
        };
      }
      return {
        text: 'Google released Gemini 2.5 Flash with improved latency and reasoning capabilities [1].',
        functionCalls: [],
      };
    },
  },
  {
    id: 'D2',
    category: 'web_research',
    name: 'Node.js Active LTS Version',
    description: 'Current Node release status verification.',
    setupConversations: [
      {
        title: 'Node Setup',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What is the current Node.js Active LTS version?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['Node', 'LTS'],
      shouldContainCitations: true,
    },
    mockTavilyResponse: () => [
      {
        title: 'Node.js Releases',
        url: 'https://nodejs.org/en/about/previous-releases',
        content: 'Node.js 22 is currently in Active LTS status.',
        publishedDate: '2026-01-01',
      },
    ],
    mockGeminiResponse: (turn) => {
      if (turn === 1) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'current Node.js Active LTS version' } }],
        };
      }
      return {
        text: 'The current Active LTS release of Node.js is version 22 [1].',
        functionCalls: [],
      };
    },
  },
  {
    id: 'D3',
    category: 'web_research',
    name: 'Conceptual Question (Search Not Required)',
    description: 'What is RAG? Should be answered directly from knowledge.',
    setupConversations: [
      {
        title: 'Concepts',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What is Retrieval-Augmented Generation (RAG)?',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Retrieval', 'Generation'],
      shouldContainCitations: false,
    },
    mockGeminiResponse: () => ({
      text: 'Retrieval-Augmented Generation (RAG) is an AI architecture that enhances language models by retrieving relevant external facts before generating an answer.',
      functionCalls: [],
    }),
  },
  {
    id: 'D4',
    category: 'web_research',
    name: 'Internal Conversation Summary (Search Not Required)',
    description: 'Asking to summarize previous chat messages without web search.',
    setupConversations: [
      {
        title: 'Weekly Standup',
        messages: [
          { role: 'user', content: 'Completed the Fastify migration.' },
          { role: 'user', content: 'Configured Zod environment validation.' },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'Summarize our recent project updates.',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Fastify', 'Zod'],
      shouldContainCitations: false,
    },
    mockGeminiResponse: () => ({
      text: 'Recently you completed the Fastify migration and configured Zod environment validation.',
      functionCalls: [],
    }),
  },

  // ==========================================
  // Category E: Historical versus current comparison (4 cases)
  // ==========================================
  {
    id: 'E1',
    category: 'historical_vs_current',
    name: 'Hardware Pricing Comparison (₹10,000 baseline)',
    description: 'Earlier recorded price of ₹10,000 vs current price found via web search.',
    setupConversations: [
      {
        title: 'Procurement Specs',
        messages: [
          { role: 'user', content: 'We found the development server listed at ₹10,000 last month.' },
        ],
        memories: [
          {
            type: 'fact',
            subject: 'Server Price',
            content: 'Development server listed at ₹10,000.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'Has the development server price changed compared to what we saw earlier?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['10,000', '12,500'],
      shouldContainCitations: true,
    },
    mockTavilyResponse: () => [
      {
        title: 'Server Retail Listing',
        url: 'https://store.example.com/dev-server',
        content: 'Current advertised price for Dev Server is ₹12,500 as of recent listing.',
        publishedDate: '2026-03-01',
      },
    ],
    mockGeminiResponse: (turn) => {
      if (turn === 1) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'development server current price' } }],
        };
      }
      return {
        text: 'Earlier you recorded the price as ₹10,000. Current listings show it advertised at ₹12,500 [1], an increase of ₹2,500.',
        functionCalls: [],
      };
    },
  },
  {
    id: 'E2',
    category: 'historical_vs_current',
    name: 'PostgreSQL Major Version Comparison',
    description: 'Historical discussion on Postgres 15 vs current version Postgres 17.',
    setupConversations: [
      {
        title: 'Database Planning',
        messages: [
          { role: 'user', content: 'We are currently running PostgreSQL version 15 in production.' },
        ],
        memories: [
          {
            type: 'fact',
            subject: 'PostgreSQL version',
            content: 'Running PostgreSQL version 15 in production.',
          },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'Are we on the latest PostgreSQL major version?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['15', '17'],
      shouldContainCitations: true,
    },
    mockTavilyResponse: () => [
      {
        title: 'PostgreSQL Current Versions',
        url: 'https://www.postgresql.org/support/versioning/',
        content: 'PostgreSQL 17 is the latest major release.',
        publishedDate: '2026-02-01',
      },
    ],
    mockGeminiResponse: (turn) => {
      if (turn === 1) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'latest PostgreSQL major version' } }],
        };
      }
      return {
        text: 'No, you are currently running PostgreSQL 15, but PostgreSQL 17 is now available as the latest major release [1].',
        functionCalls: [],
      };
    },
  },
  {
    id: 'E3',
    category: 'historical_vs_current',
    name: 'Price Check Without Prior Baseline',
    description: 'User asks if price changed, but no prior price was ever discussed.',
    setupConversations: [
      {
        title: 'New Gadget',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'Has the WidgetPro price changed from our original estimate?',
    expected: {
      searchRequired: false,
      expectedKeywords: [],
      shouldDiscloseUnverified: true,
    },
    mockGeminiResponse: () => ({
      text: 'I do not have any record of your original price estimate for WidgetPro in our previous discussions, so I cannot verify whether it has changed.',
      functionCalls: [],
    }),
  },
  {
    id: 'E4',
    category: 'historical_vs_current',
    name: 'Unverified Change Date Disclaimer',
    description: 'Confirm agent avoids claiming an exact change date when sources do not specify it.',
    setupConversations: [
      {
        title: 'SaaS Tooling',
        messages: [
          { role: 'user', content: 'Figma professional plan was $12 per user/month.' },
        ],
        memories: [
          { type: 'fact', subject: 'Figma price', content: 'Figma professional was $12/user/month.' },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What is the current Figma pricing and exactly when did it change?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['Figma', '15'],
      shouldContainCitations: true,
    },
    mockTavilyResponse: () => [
      {
        title: 'Figma Pricing',
        url: 'https://www.figma.com/pricing/',
        content: 'Professional plan is $15 per editor/month.',
      },
    ],
    mockGeminiResponse: (turn) => {
      if (turn === 1) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'Figma current pricing professional plan' } }],
        };
      }
      return {
        text: 'The current Figma Professional plan is $15 per editor/month [1]. While your previous note showed $12, the search result does not specify the exact date when this change took effect.',
        functionCalls: [],
      };
    },
  },

  // ==========================================
  // Category F: Failure & Edge cases (4 cases)
  // ==========================================
  {
    id: 'F1',
    category: 'failure_scenarios',
    name: 'Tavily Search Failure Graceful Degradation',
    description: 'When Tavily throws an error, Gemini discloses search failure.',
    setupConversations: [
      {
        title: 'Market Research',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What are the latest semiconductor export rules?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['could not verify', 'search'],
      shouldDiscloseUnverified: true,
    },
    mockTavilyResponse: () => {
      throw new Error('Tavily API 429 Rate Limit Exceeded');
    },
    mockGeminiResponse: (turn, _q, toolsCalled) => {
      if (turn === 1 && !toolsCalled) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'latest semiconductor export rules 2026' } }],
        };
      }
      return {
        text: 'I could not verify the current semiconductor export rules because the live web search service was unavailable.',
        functionCalls: [],
      };
    },
  },
  {
    id: 'F2',
    category: 'failure_scenarios',
    name: 'Gemini Failure Preserves User Message',
    description: 'When Gemini crashes, the user message remains in the database.',
    setupConversations: [
      {
        title: 'Critical Storage',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'My critical input message before API crash.',
    expected: {
      searchRequired: false,
      expectedKeywords: [],
      expectFailure: true,
    },
    mockGeminiResponse: () => {
      throw new Error('Gemini 503 Service Unavailable');
    },
  },
  {
    id: 'F3',
    category: 'failure_scenarios',
    name: 'Empty Web Search Results (No Hallucination)',
    description: 'When Tavily returns 0 results, agent discloses lack of evidence.',
    setupConversations: [
      {
        title: 'Niche Query',
        messages: [],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'What is the release date of QuantumOS v99.1?',
    expected: {
      searchRequired: true,
      expectedKeywords: ['could not find'],
      shouldDiscloseUnverified: true,
    },
    mockTavilyResponse: () => [],
    mockGeminiResponse: (turn, _q, toolsCalled) => {
      if (turn === 1 && !toolsCalled) {
        return {
          text: null,
          functionCalls: [{ name: 'web_search', args: { query: 'QuantumOS v99.1 release date' } }],
        };
      }
      return {
        text: 'I could not find any search results or verified information regarding a release date for QuantumOS v99.1.',
        functionCalls: [],
      };
    },
  },
  {
    id: 'F4',
    category: 'failure_scenarios',
    name: 'Duplicate Memory Avoidance',
    description: 'Ensure identical facts are not inserted multiple times.',
    setupConversations: [
      {
        title: 'Deduplication Test',
        messages: [
          { role: 'user', content: 'Our primary headquarters is in Berlin.' },
        ],
        memories: [
          { type: 'fact', subject: 'Headquarters', content: 'Primary headquarters is in Berlin.' },
        ],
      },
    ],
    activeConversationIndex: 0,
    userMessage: 'Remember that our primary headquarters is in Berlin.',
    expected: {
      searchRequired: false,
      expectedKeywords: ['Berlin'],
      expectedMemoryTypes: ['fact'],
    },
    mockGeminiResponse: () => ({
      text: 'Understood, your primary headquarters is in Berlin.',
      functionCalls: [],
    }),
  },
];
