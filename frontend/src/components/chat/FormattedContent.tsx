import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface FormattedContentProps {
  content: string;
  onCitationClick?: (citationNumber: number) => void;
}

export const FormattedContent: React.FC<FormattedContentProps> = ({ content, onCitationClick }) => {
  // Split into code blocks vs regular text
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {parts.map((part, index) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          return <CodeBlock key={index} rawCode={part} />;
        }
        return (
          <TextParagraphs
            key={index}
            text={part}
            onCitationClick={onCitationClick}
          />
        );
      })}
    </div>
  );
};

const CodeBlock: React.FC<{ rawCode: string }> = ({ rawCode }) => {
  const [copied, setCopied] = useState(false);
  const lines = rawCode.slice(3, -3).trim().split('\n');
  const language = lines[0].match(/^[a-zA-Z0-9_-]+$/) ? lines[0] : '';
  const code = language ? lines.slice(1).join('\n') : lines.join('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2.5 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-800/80 border-b border-slate-700/60 text-slate-400">
        <span className="text-[11px] font-medium tracking-wide uppercase">{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-slate-700/70 text-slate-300 transition-colors"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
};

const TextParagraphs: React.FC<{ text: string; onCitationClick?: (n: number) => void }> = ({
  text,
  onCitationClick,
}) => {
  const lines = text.split('\n');

  return (
    <>
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return <div key={lineIdx} className="h-1.5" />;
        }

        // Bullet point
        if (trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const bulletText = trimmed.replace(/^[•\-*]\s*/, '');
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2">
              <span className="text-emerald-500 dark:text-emerald-400 mt-1">•</span>
              <div className="flex-1">
                <InlineFormatter text={bulletText} onCitationClick={onCitationClick} />
              </div>
            </div>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-2">
              <span className="text-slate-400 dark:text-slate-500 font-mono text-xs mt-0.5 font-semibold">
                {numMatch[1]}.
              </span>
              <div className="flex-1">
                <InlineFormatter text={numMatch[2]} onCitationClick={onCitationClick} />
              </div>
            </div>
          );
        }

        // Header ###
        if (trimmed.startsWith('### ')) {
          return (
            <h4 key={lineIdx} className="font-semibold text-slate-900 dark:text-slate-100 text-sm mt-3 mb-1">
              <InlineFormatter text={trimmed.slice(4)} onCitationClick={onCitationClick} />
            </h4>
          );
        }

        // Header ##
        if (trimmed.startsWith('## ')) {
          return (
            <h3 key={lineIdx} className="font-bold text-slate-900 dark:text-slate-100 text-base mt-3.5 mb-1">
              <InlineFormatter text={trimmed.slice(3)} onCitationClick={onCitationClick} />
            </h3>
          );
        }

        return (
          <p key={lineIdx}>
            <InlineFormatter text={line} onCitationClick={onCitationClick} />
          </p>
        );
      })}
    </>
  );
};

const InlineFormatter: React.FC<{ text: string; onCitationClick?: (n: number) => void }> = ({
  text,
  onCitationClick,
}) => {
  // Matches bold **text**, inline code `code`, and citations [1]
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;
  const parts = text.split(tokenRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null;

        // Bold
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
              {part.slice(2, -2)}
            </strong>
          );
        }

        // Inline code
        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-700/80"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        // Citation [1], [2], etc.
        const citMatch = part.match(/^\[(\d+)\]$/);
        if (citMatch) {
          const num = parseInt(citMatch[1], 10);
          return (
            <button
              key={i}
              type="button"
              onClick={() => onCitationClick && onCitationClick(num)}
              className="inline-flex items-center justify-center mx-0.5 px-1.5 py-0.2 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-300/80 dark:border-emerald-700/80 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/90 hover:scale-105 transition-all shadow-sm"
              title={`View Source [${num}]`}
            >
              [{num}]
            </button>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

