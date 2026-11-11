import React from 'react';
import { CheckCircle2, Lightbulb, Settings, AlertOctagon, Link2 } from 'lucide-react';
import { Memory, MemoryType } from '../../types';

interface MemoryCardProps {
  memory: Memory;
}

export const MemoryCard: React.FC<MemoryCardProps> = ({ memory }) => {
  const getBadgeConfig = (type: MemoryType) => {
    switch (type) {
      case 'decision':
        return {
          icon: <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />,
          label: 'Decision',
          classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'fact':
        return {
          icon: <Lightbulb className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />,
          label: 'Fact',
          classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        };
      case 'preference':
        return {
          icon: <Settings className="w-3 h-3 text-purple-600 dark:text-purple-400" />,
          label: 'Preference',
          classes: 'bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200 dark:border-purple-800',
        };
      case 'constraint':
        return {
          icon: <AlertOctagon className="w-3 h-3 text-amber-600 dark:text-amber-400" />,
          label: 'Constraint',
          classes: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200 dark:border-amber-800',
        };
    }
  };

  const config = getBadgeConfig(memory.type);
  const formattedDate = new Date(memory.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="rounded-xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 shadow-sm hover:border-slate-300 dark:hover:border-neutral-700 transition-all text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${config.classes}`}
          >
            {config.icon}
            {config.label}
          </span>
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            #{memory.subject}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {formattedDate}
        </span>
      </div>

      <p className="text-slate-800 dark:text-slate-200 leading-relaxed font-normal">
        {memory.content}
      </p>

      {memory.source_message_id && (
        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
          <span className="inline-flex items-center gap-1 font-mono">
            <Link2 className="w-2.5 h-2.5" />
            <span>Ref: {memory.source_message_id.slice(0, 12)}...</span>
          </span>
        </div>
      )}
    </div>
  );
};

