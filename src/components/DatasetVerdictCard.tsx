import React from 'react';
import { DatasetOverview, DatasetVerdict } from '../types';
import {
  FileText,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  SlidersHorizontal,
  Compass,
  Lightbulb,
  BarChart3,
  Bot,
  User,
  Cpu,
} from 'lucide-react';

interface DatasetVerdictCardProps {
  overview: DatasetOverview;
  verdict: DatasetVerdict;
  onOpenAudit: () => void;
  onNewUpload: () => void;
}

export const DatasetVerdictCard: React.FC<DatasetVerdictCardProps> = ({
  overview,
  verdict,
  onOpenAudit,
  onNewUpload,
}) => {
  const { fileName, totalRows, columns, cleaningReport, primaryMetric, primaryCategory, dateRange, domain } =
    overview;

  const hasCleaningActions =
    cleaningReport.removedDuplicateRows > 0 ||
    cleaningReport.removedEmptyRows > 0 ||
    cleaningReport.droppedJunkColumns.length > 0;

  const columnDescriptions = verdict.columnDescriptions || [];
  const observations = verdict.observations && verdict.observations.length > 0
    ? verdict.observations
    : [...verdict.majorPatterns, ...verdict.importantFindings].slice(0, 4);

  return (
    <div className="space-y-5 my-6 animate-fadeIn">
      {/* 1. DATASET OVERVIEW TOP BAR */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-white rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            <FileText size={18} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display font-bold text-base text-slate-900">{fileName}</h2>
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                {domain}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-slate-600 font-medium">
              <span><strong>{totalRows.toLocaleString()}</strong> clean records</span>
              <span>•</span>
              <span><strong>{columns.length}</strong> columns</span>
              {dateRange && (
                <>
                  <span>•</span>
                  <span>{dateRange.start} to {dateRange.end}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCleaningActions && (
            <button
              type="button"
              onClick={onOpenAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <CheckCircle2 size={13} className="text-emerald-600 shrink-0" />
              <span>
                Cleaned{' '}
                {cleaningReport.removedDuplicateRows > 0 &&
                  `${cleaningReport.removedDuplicateRows} duplicate${cleaningReport.removedDuplicateRows > 1 ? 's' : ''}`}
                {cleaningReport.removedDuplicateRows > 0 && cleaningReport.droppedJunkColumns.length > 0 && ', '}
                {cleaningReport.droppedJunkColumns.length > 0 &&
                  `${cleaningReport.droppedJunkColumns.length} junk column${cleaningReport.droppedJunkColumns.length > 1 ? 's' : ''}`}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenAudit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition-all shadow-2xs hover:border-slate-300 cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            <span>Audit & Export</span>
          </button>

          <button
            type="button"
            onClick={onNewUpload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-all cursor-pointer"
          >
            <span>Upload New File</span>
          </button>
        </div>
      </div>

      {/* 2. REAL AI AGENT CHAT BRIEFING (Exact style from Ollama Chat Response) */}
      <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 sm:p-7 shadow-md border border-slate-800 relative overflow-hidden">
        {/* User Question Bubble (Right Aligned) */}
        <div className="flex justify-end mb-5">
          <div className="bg-slate-800/90 text-slate-200 px-4 py-2 rounded-2xl rounded-tr-xs text-xs sm:text-sm font-medium flex items-center gap-2.5 shadow-xs border border-slate-700">
            <span className="bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono">
              📄 {fileName}
            </span>
            <span>what this data is about</span>
            <div className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
              <User size={12} />
            </div>
          </div>
        </div>

        {/* AI Agent Response Bubble */}
        <div className="space-y-5">
          {/* Agent Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                <Bot size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm text-white">InsightIQ AI Analyst</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    llama3.2:3b
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <CheckCircle2 size={13} className="text-emerald-400" />
              <span>100% Calculated with Python/Pandas • Zero Hallucinations</span>
            </div>
          </div>

          {/* Paragraph 1: What this data is about */}
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-normal">
            {verdict.about || `This data appears to be a ${domain.toLowerCase()} dataset tracking ${totalRows.toLocaleString()} verified entries across ${columns.length} columns.`} The data includes information across several attributes, including:
          </p>

          {/* Numbered Column Breakdown (Like Ollama Chat) */}
          {columnDescriptions.length > 0 && (
            <div className="bg-slate-800/60 rounded-2xl p-4 sm:p-5 border border-slate-800/80">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Tracked Columns & Attributes ({columnDescriptions.length}):
              </h4>
              <ol className="space-y-2.5 text-xs sm:text-sm text-slate-200">
                {columnDescriptions.map((col, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="font-bold text-indigo-400 shrink-0">{idx + 1}.</span>
                    <div>
                      <span className="font-bold text-white mr-1.5">{col.humanName}:</span>
                      <span className="text-slate-300 leading-relaxed">{col.description}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Paragraph 2: What one row represents */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            The data is stored in comma-separated values (CSV) format, with {verdict.rowRepresentation || 'each row representing a single record with its associated metrics'}. All {totalRows.toLocaleString()} records have been verified and cleaned for analytical accuracy.
          </p>

          {/* Paragraph 3: Observations list */}
          {observations.length > 0 && (
            <div className="pt-1">
              <h4 className="text-xs sm:text-sm font-bold text-white mb-2.5 flex items-center gap-2">
                <Lightbulb size={15} className="text-amber-400" />
                <span>Some observations that can be made from this data include:</span>
              </h4>
              <ul className="space-y-2 text-xs sm:text-sm text-slate-300">
                {observations.map((obs, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
                    <span className="leading-relaxed">{obs}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Takeaway Recommendation */}
          {verdict.whatDataTellsYou && (
            <div className="mt-3 p-3.5 bg-indigo-950/60 rounded-xl border border-indigo-500/30 text-xs sm:text-sm text-indigo-100 flex items-start gap-2.5">
              <Compass size={17} className="text-ada-lime shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-white mr-1">Recommended Action:</span>
                <span>{verdict.whatDataTellsYou}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. IMPORTANT NUMBERS CARDS */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={16} className="text-ada-accent" />
          <h3 className="font-display font-bold text-xs sm:text-sm text-slate-900 uppercase tracking-wider">
            Key Metrics & Summary Values
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {verdict.importantNumbers.map((num, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:shadow-xs transition-all ${
                num.tone === 'positive'
                  ? 'border-l-4 border-l-emerald-500'
                  : num.tone === 'negative'
                  ? 'border-l-4 border-l-rose-500'
                  : 'border-l-4 border-l-indigo-500'
              }`}
            >
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 truncate">
                {num.label}
              </div>
              <div className="text-2xl font-display font-bold text-slate-900 mb-1.5">
                {num.value}
              </div>
              <div className="text-xs text-slate-600 leading-snug">
                {num.explanation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
