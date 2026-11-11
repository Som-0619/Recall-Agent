import React, { useState } from 'react';
import {
  Plus,
  MessageSquare,
  Trash2,
  Search,
  Sparkles,
  Server,
  PlayCircle,
  Moon,
  Sun,
  RotateCcw,
  Layers,
} from 'lucide-react';
import { Conversation, AppMode, HealthStatus } from '../../types';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
  appMode: AppMode;
  onToggleMode: (mode: AppMode) => void;
  health: HealthStatus;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onResetDemoData: () => void;
  isOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  appMode,
  onToggleMode,
  health,
  darkMode,
  onToggleDarkMode,
  onResetDemoData,
  isOpen,
  onCloseMobile,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-white dark:bg-[#000000] border-r border-slate-200 dark:border-neutral-800 flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Branding header */}
        <div className="p-4 border-b border-slate-200/80 dark:border-neutral-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30">
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <div>
                <span className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  Recall
                </span>
                <span className="ml-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200/50 dark:border-emerald-800/50">
                  v1.0
                </span>
              </div>
            </div>

            <button
              onClick={onToggleDarkMode}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
              title={darkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>

          {/* Mode Switcher Toggle */}
          <div className="mt-3.5 p-1 rounded-xl bg-slate-100 dark:bg-neutral-900 border border-transparent dark:border-neutral-800 flex items-center text-xs font-medium">
            <button
              type="button"
              onClick={() => onToggleMode('live')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                appMode === 'live'
                  ? 'bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Server className="w-3.5 h-3.5" />
              <span>Live Backend</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleMode('demo')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all ${
                appMode === 'demo'
                  ? 'bg-amber-500 text-white shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Demo Mode</span>
            </button>
          </div>
        </div>

        {/* New chat action */}
        <div className="p-3 border-b border-slate-100 dark:border-neutral-800">
          <button
            type="button"
            onClick={onNewConversation}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99]"
          >
            <Plus className="w-4 h-4" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Search filter */}
        <div className="px-3 pt-2.5 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-400"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 px-4 text-center">
              <MessageSquare className="w-6 h-6 text-slate-300 dark:text-neutral-700 mx-auto mb-1.5" />
              <p className="text-xs text-slate-400 dark:text-neutral-500">
                {searchQuery ? 'No matching chats' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filtered.map((conv) => {
              const isActive = conv.id === activeConversationId;
              const formattedDate = new Date(conv.updated_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={conv.id}
                  onClick={() => onSelectConversation(conv.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-neutral-900 text-emerald-900 dark:text-white font-semibold dark:border dark:border-neutral-800'
                      : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-900/60 hover:text-slate-800 dark:hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <MessageSquare
                      className={`w-3.5 h-3.5 flex-shrink-0 ${
                        isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 dark:text-neutral-500 flex-shrink-0 group-hover:hidden">
                      {formattedDate}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteConversation(conv.id);
                      }}
                      className="hidden group-hover:flex items-center justify-center p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-neutral-800 transition-colors"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info & status */}
        <div className="p-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-[#000000] text-xs space-y-2">
          {appMode === 'live' ? (
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    health.status === 'ok'
                      ? 'bg-emerald-500 animate-pulse'
                      : health.status === 'error'
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                />
                <span>
                  {health.status === 'ok'
                    ? `Fastify Online (${health.latency || 0}ms)`
                    : 'Backend Offline'}
                </span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">:3000</span>
            </div>
          ) : (
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Demo (No keys needed)</span>
              </span>
              <button
                type="button"
                onClick={onResetDemoData}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Reset demo data to initial state"
              >
                <RotateCcw className="w-2.5 h-2.5" />
                <span>Reset</span>
              </button>
            </div>
          )}

          <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3 h-3" />
              <span>SQLite FTS5 + Tavily</span>
            </span>
            <span>MIT License</span>
          </div>
        </div>
      </aside>
    </>
  );
};

