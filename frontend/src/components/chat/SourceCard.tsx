import React, { useState } from 'react';
import { ExternalLink, Globe, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import { SearchResult } from '../../types';

interface SourceCardProps {
  source: SearchResult;
  index: number;
  isHighlighted?: boolean;
}

export const SourceCard: React.FC<SourceCardProps> = ({ source, index, isHighlighted }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formattedDate = source.published_at
    ? new Date(source.published_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <div
      id={`source-${index + 1}`}
      className={`group relative rounded-lg border p-3 transition-all duration-200 text-xs ${
        isHighlighted
          ? 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
          : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-slate-300 dark:hover:border-neutral-700 shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px]">
            {index + 1}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono text-[10px] truncate">
            <Globe className="w-2.5 h-2.5 flex-shrink-0" />
            {source.domain || 'web'}
          </span>
          {formattedDate && (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
              <Calendar className="w-2.5 h-2.5" />
              {formattedDate}
            </span>
          )}
        </div>

        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          title="Open original source"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 block font-medium text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 line-clamp-1 transition-colors"
      >
        {source.title || source.url}
      </a>

      {source.content && (
        <div className="mt-1.5">
          <p
            className={`text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed ${
              isExpanded ? '' : 'line-clamp-2'
            }`}
          >
            {source.content}
          </p>
          {source.content.length > 100 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              {isExpanded ? (
                <>
                  <span>Show less</span>
                  <ChevronUp className="w-2.5 h-2.5" />
                </>
              ) : (
                <>
                  <span>Read snippet</span>
                  <ChevronDown className="w-2.5 h-2.5" />
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

