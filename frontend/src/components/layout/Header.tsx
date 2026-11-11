import React, { useState, useEffect } from 'react';
import { Menu, Database, Check, Edit2 } from 'lucide-react';
import { Conversation, AppMode } from '../../types';

interface HeaderProps {
  conversation: Conversation | null;
  onRenameConversation: (newTitle: string) => void;
  onToggleMemoryPanel: () => void;
  isMemoryPanelOpen: boolean;
  memoryCount: number;
  appMode: AppMode;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  conversation,
  onRenameConversation,
  onToggleMemoryPanel,
  isMemoryPanelOpen,
  memoryCount,
  appMode,
  onOpenMobileMenu,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  useEffect(() => {
    if (conversation) {
      setTitleInput(conversation.title);
    }
  }, [conversation]);

  const handleSaveRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!titleInput.trim() || !conversation) return;
    onRenameConversation(titleInput.trim());
    setIsEditing(false);
  };

  return (
    <header className="h-14 border-b border-slate-200 dark:border-neutral-800 bg-white/90 dark:bg-[#000000]/90 backdrop-blur-md px-4 flex items-center justify-between z-20 flex-shrink-0 text-slate-900 dark:text-white">
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onOpenMobileMenu}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 md:hidden"
          title="Open conversation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {conversation ? (
          <div className="flex items-center gap-2 min-w-0">
            {isEditing ? (
              <form onSubmit={handleSaveRename} className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  autoFocus
                  onBlur={handleSaveRename}
                  className="px-2 py-0.5 rounded-md border border-emerald-500 bg-white dark:bg-neutral-900 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="p-1 text-emerald-600 hover:text-emerald-500"
                  title="Save title"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2 min-w-0 group">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {conversation.title}
                </h2>
                <button
                  onClick={() => setIsEditing(true)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-opacity"
                  title="Rename chat"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ) : (
          <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
            New Research Session
          </h2>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Mode badge */}
        {appMode === 'demo' ? (
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
            Demo Mode (Simulated)
          </span>
        ) : (
          <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            Live Backend
          </span>
        )}

        {/* Memory drawer toggle button */}
        <button
          type="button"
          onClick={onToggleMemoryPanel}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
            isMemoryPanelOpen
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-slate-700 dark:text-white hover:border-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 shadow-xs'
          }`}
          title="Toggle conversation memory panel"
        >
          <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="hidden sm:inline">Memories</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              isMemoryPanelOpen
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-emerald-400'
            }`}
          >
            {memoryCount}
          </span>
        </button>
      </div>
    </header>
  );
};

