import React, { useRef, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { Message, AppMode } from '../../types';
import { MessageBubble } from './MessageBubble';
import { WelcomeScreen } from './WelcomeScreen';
import { MessageInput } from './MessageInput';

interface ChatAreaProps {
  messages: Message[];
  isLoading: boolean;
  isInitialLoading?: boolean;
  hasActiveConversation?: boolean;
  appMode: AppMode;
  onSendMessage: (message: string) => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  isLoading,
  isInitialLoading = false,
  hasActiveConversation = false,
  appMode,
  onSendMessage,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-white dark:bg-black text-slate-900 dark:text-white">
      {/* Message history or welcome screen */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {isInitialLoading && hasActiveConversation ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <WelcomeScreen
            onSelectPrompt={onSendMessage}
            isDemoMode={appMode === 'demo'}
          />
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Loading / research indicator */}
            {isLoading && (
              <div className="flex items-start gap-3 max-w-3xl mr-auto">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-2.5 text-xs text-slate-600 dark:text-neutral-300">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                  </span>
                  <span>
                    {appMode === 'demo'
                      ? 'Simulating memory extraction and research...'
                      : 'Searching FTS5 memory, querying web if needed, and synthesizing response...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Message composer */}
      <MessageInput
        onSendMessage={onSendMessage}
        isLoading={isLoading}
        isDemoMode={appMode === 'demo'}
      />
    </div>
  );
};

