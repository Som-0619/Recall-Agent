import React, { useState } from 'react';
import { User, Sparkles, Check, Copy, BookOpen } from 'lucide-react';
import { Message } from '../../types';
import { FormattedContent } from './FormattedContent';
import { SourceCard } from './SourceCard';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);
  const [highlightedSource, setHighlightedSource] = useState<number | null>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCitationClick = (citationNumber: number) => {
    setHighlightedSource(citationNumber);
    const element = document.getElementById(`source-${citationNumber}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    setTimeout(() => setHighlightedSource(null), 3000);
  };

  const timeString = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex justify-end gap-3 max-w-3xl ml-auto group">
        <div className="flex flex-col items-end max-w-[85%]">
          <div className="bg-emerald-600 text-white dark:bg-neutral-900 dark:text-white dark:border dark:border-neutral-800 px-4 py-2.5 rounded-2xl rounded-tr-sm shadow-sm text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 mt-1 mr-1">
            {timeString}
          </span>
        </div>
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-100 dark:bg-neutral-800 dark:border dark:border-neutral-700 flex items-center justify-center text-emerald-800 dark:text-neutral-200 shadow-sm mt-0.5">
          <User className="w-4 h-4" />
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex justify-start gap-3 max-w-3xl mr-auto group">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-600/30 mt-0.5">
        <Sparkles className="w-4 h-4" />
      </div>

      <div className="flex flex-col items-start max-w-[90%] w-full">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-slate-800 dark:text-white">
            Recall
          </span>
          {message.isSimulated && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300/60 dark:border-amber-700/60">
              Demo Mode • Simulated
            </span>
          )}
          <span className="text-[10px] text-slate-400 dark:text-neutral-500">
            {timeString}
          </span>
        </div>

        <div className="w-full bg-slate-50 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800 p-4 rounded-2xl rounded-tl-sm shadow-sm text-slate-900 dark:text-white relative">
          <FormattedContent
            content={message.content}
            onCitationClick={handleCitationClick}
          />

          {/* Render verified web research sources if present */}
          {message.sources && message.sources.length > 0 && (
            <div className="mt-4 pt-3.5 border-t border-slate-200 dark:border-neutral-800">
              <div className="flex items-center gap-1.5 mb-2.5 text-xs font-semibold text-slate-800 dark:text-neutral-200">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Verified Sources ({message.sources.length})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {message.sources.map((source, idx) => (
                  <SourceCard
                    key={idx}
                    source={source}
                    index={idx}
                    isHighlighted={highlightedSource === idx + 1}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Copy action on hover */}
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-neutral-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              title="Copy message"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

