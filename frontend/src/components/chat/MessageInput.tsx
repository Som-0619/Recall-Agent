import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Loader2 } from 'lucide-react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  isDemoMode: boolean;
}

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading,
  isDemoMode,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [text]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    onSendMessage(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-4 pt-1">
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col bg-white dark:bg-neutral-900 border border-slate-300 dark:border-neutral-800 rounded-2xl shadow-sm focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question, state a decision, or search for current facts..."
          rows={1}
          disabled={isLoading}
          className="w-full resize-none bg-transparent px-4 pt-3.5 pb-10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none min-h-[48px] max-h-[180px]"
        />

        <div className="absolute right-2.5 bottom-2.5 flex items-center gap-2">
          <button
            type="submit"
            disabled={!text.trim() || isLoading}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 dark:disabled:bg-neutral-800 disabled:text-slate-400 dark:disabled:text-neutral-600 text-white transition-all shadow-sm disabled:shadow-none hover:scale-105 active:scale-95"
            title="Send message (Enter)"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </form>

      <div className="mt-1.5 px-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
        <span>
          {isDemoMode ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              Demo Mode active — Simulated responses (No API keys required)
            </span>
          ) : (
            <span>Recall uses SQLite FTS5 for memory and Tavily for grounded research</span>
          )}
        </span>
        <span className="hidden sm:inline">Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
};

