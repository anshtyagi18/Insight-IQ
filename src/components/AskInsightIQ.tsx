import React, { useState } from 'react';
import { Search, CornerDownLeft, History, X } from 'lucide-react';

interface AskInsightIQProps {
  onAsk: (question: string) => void;
  isLoading: boolean;
  recentQueries: string[];
}

export const AskInsightIQ: React.FC<AskInsightIQProps> = ({
  onAsk,
  isLoading,
  recentQueries,
}) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    onAsk(inputValue.trim());
  };

  return (
    <div className="my-6 p-6 rounded-2xl bg-white border border-ada-line shadow-xs">
      <div className="mb-3">
        <h3 className="font-display font-bold text-base text-ada-ink">
          Ask a Question About Your Data
        </h3>
        <p className="text-xs text-ada-muted">
          Type any question in plain English. InsightIQ will calculate exact answers and render an interactive chart.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="relative flex items-center">
        <div className="absolute left-3.5 text-slate-400 pointer-events-none">
          <Search size={18} />
        </div>

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="e.g., Which category has the highest sales? What was our monthly trend? Show average revenue..."
          className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-ada-accent focus:bg-white transition-all font-medium"
        />

        {inputValue && (
          <button
            type="button"
            onClick={() => setInputValue('')}
            className="absolute right-20 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
          >
            <X size={15} />
          </button>
        )}

        <button
          type="submit"
          disabled={!inputValue.trim() || isLoading}
          className="absolute right-2 inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Analyzing...</span>
            </span>
          ) : (
            <>
              <span>Ask</span>
              <CornerDownLeft size={13} />
            </>
          )}
        </button>
      </form>

      {/* Recent queries */}
      {recentQueries.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
          <div className="flex items-center gap-1 font-semibold text-ada-muted text-[11px] uppercase tracking-wider">
            <History size={12} />
            <span>Recent:</span>
          </div>
          {recentQueries.slice(0, 4).map((query, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setInputValue(query);
                onAsk(query);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors cursor-pointer truncate max-w-xs"
            >
              {query}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
