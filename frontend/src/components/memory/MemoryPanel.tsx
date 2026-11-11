import React, { useState } from 'react';
import { X, Plus, Filter, Database, Search, Loader2 } from 'lucide-react';
import { Memory, MemoryType } from '../../types';
import { MemoryCard } from './MemoryCard';

interface MemoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  memories: Memory[];
  onAddMemory: (data: { type: MemoryType; subject: string; content: string }) => Promise<void>;
  isLoading?: boolean;
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({
  isOpen,
  onClose,
  memories,
  onAddMemory,
  isLoading,
}) => {
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newType, setNewType] = useState<MemoryType>('decision');
  const [newSubject, setNewSubject] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredMemories = memories.filter((mem) => {
    const matchesType = selectedType === 'all' || mem.type === selectedType;
    const matchesSearch =
      !searchQuery ||
      mem.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      mem.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubject.trim() || !newContent.trim()) return;

    try {
      setIsSubmitting(true);
      await onAddMemory({
        type: newType,
        subject: newSubject.trim(),
        content: newContent.trim(),
      });
      setNewSubject('');
      setNewContent('');
      setIsAdding(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const counts = {
    all: memories.length,
    decision: memories.filter((m) => m.type === 'decision').length,
    constraint: memories.filter((m) => m.type === 'constraint').length,
    fact: memories.filter((m) => m.type === 'fact').length,
    preference: memories.filter((m) => m.type === 'preference').length,
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-96 bg-white dark:bg-[#000000] border-l border-slate-200 dark:border-neutral-800 shadow-2xl flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
              <span>Conversation Memory</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-emerald-400">
                {memories.length}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-neutral-500">
              Structured facts & architectural choices
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-neutral-900 transition-colors"
          title="Close panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and search toolbar */}
      <div className="p-3 border-b border-slate-100 dark:border-neutral-800 space-y-2.5">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search memories..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900 text-xs text-slate-800 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[11px]">
          {(['all', 'decision', 'constraint', 'fact', 'preference'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`px-2 py-1 rounded-md capitalize font-medium whitespace-nowrap transition-colors ${
                selectedType === type
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-800'
              }`}
            >
              {type} ({counts[type]})
            </button>
          ))}
        </div>
      </div>

      {/* Content list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2 text-emerald-500" />
            <span className="text-xs">Loading memories...</span>
          </div>
        ) : filteredMemories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
              <Filter className="w-4 h-4" />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              No memories found
            </p>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[220px]">
              {searchQuery || selectedType !== 'all'
                ? 'Try clearing your filters.'
                : 'As you discuss choices in chat, Recall automatically extracts and saves decisions here.'}
            </p>
          </div>
        ) : (
          filteredMemories.map((mem) => <MemoryCard key={mem.id} memory={mem} />)
        )}

        {/* Add Memory Form modal or toggle */}
        {isAdding && (
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 p-3 text-xs space-y-2.5 mt-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-900 dark:text-emerald-300 text-xs">
                Record New Memory
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Type
                </label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as MemoryType)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                >
                  <option value="decision">Decision</option>
                  <option value="constraint">Constraint</option>
                  <option value="fact">Fact</option>
                  <option value="preference">Preference</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. database, compliance"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Content
              </label>
              <textarea
                required
                rows={2}
                placeholder="State the decision or constraint..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Save Memory'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Footer action */}
      <div className="p-3 border-t border-slate-200 dark:border-neutral-800 bg-slate-50/70 dark:bg-[#000000]">
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-neutral-800 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-600 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Manual Memory</span>
          </button>
        )}
      </div>
    </div>
  );
};

