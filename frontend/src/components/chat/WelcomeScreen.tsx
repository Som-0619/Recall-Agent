import React from 'react';
import { Database, Search, ShieldCheck, Cpu } from 'lucide-react';

interface WelcomeScreenProps {
  onSelectPrompt: (prompt: string) => void;
  isDemoMode?: boolean;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onSelectPrompt }) => {
  const samplePrompts = [
    {
      icon: <Database className="w-4 h-4 text-emerald-500" />,
      title: 'Record an Architecture Decision',
      desc: 'Stores a structured technical decision or constraint in memory',
      prompt: 'For our backend stack, we decided to use Fastify and PostgreSQL, with a strict rule: all APIs must be HIPAA compliant.',
    },
    {
      icon: <Search className="w-4 h-4 text-emerald-500" />,
      title: 'Current Web Research',
      desc: 'Triggers autonomous search and returns verified citations [1]',
      prompt: 'What is the latest stable version of Fastify and what are the key updates in that major release?',
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-emerald-500" />,
      title: 'Recall Past Decisions',
      desc: 'Tests cross-turn recall of previously discussed choices',
      prompt: 'What database and payment provider did we choose earlier for checkout?',
    },
    {
      icon: <Cpu className="w-4 h-4 text-emerald-500" />,
      title: 'Conceptual Reasoning',
      desc: 'Answers directly from knowledge without unnecessary web search',
      prompt: 'What is SQLite FTS5 and how does its BM25 ranking algorithm compare to vector embeddings?',
    },
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-2xl mx-auto px-4 text-center">
      {/* Brand icon */}
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">
        How can I help you today?
      </h1>

      <p className="text-sm text-slate-500 dark:text-neutral-400 max-w-md mb-8 leading-relaxed">
        Ask a question, record an architectural decision, or search for current facts.
      </p>

      {/* Starter prompt grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full text-left">
        {samplePrompts.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectPrompt(item.prompt)}
            className="group flex flex-col p-3.5 rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:dark:bg-neutral-800/80 hover:shadow-sm hover:scale-[1.01] transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <div className="p-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 group-hover:bg-emerald-50 dark:group-hover:bg-emerald-950/50 transition-colors">
                {item.icon}
              </div>
              <span className="text-xs font-semibold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {item.title}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2">
              {item.desc}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

