import React from 'react';
import { HelpCircle, Sparkles, ArrowRight } from 'lucide-react';

interface SuggestedQuestionsProps {
  questions: string[];
  onSelectQuestion: (question: string) => void;
}

export const SuggestedQuestions: React.FC<SuggestedQuestionsProps> = ({
  questions,
  onSelectQuestion,
}) => {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="my-6 p-5 rounded-2xl bg-white/90 border border-ada-line shadow-xs">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={16} className="text-ada-accent" />
        <h3 className="font-display font-bold text-sm text-ada-ink uppercase tracking-wider">
          Suggested Questions
        </h3>
        <span className="text-xs text-ada-muted ml-auto font-normal">
          Click any question to analyze immediately
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {questions.map((q, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelectQuestion(q)}
            className="group inline-flex items-center gap-2 px-3.5 py-2 bg-slate-50 hover:bg-ada-accent-soft text-slate-800 hover:text-ada-accent text-xs sm:text-sm font-semibold rounded-xl border border-slate-200 hover:border-ada-accent/40 transition-all shadow-2xs hover:shadow-xs hover:translate-y-[-1px] cursor-pointer text-left"
          >
            <span>{q}</span>
            <ArrowRight
              size={13}
              className="text-slate-400 group-hover:text-ada-accent group-hover:translate-x-0.5 transition-all shrink-0"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
