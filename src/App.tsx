import React, { useState, useRef, useEffect } from 'react';
import { Nav } from './components/Nav';
import { Hero } from './components/Hero';
import { UploadZone } from './components/UploadZone';
import { DatasetVerdictCard } from './components/DatasetVerdictCard';
import { SuggestedQuestions } from './components/SuggestedQuestions';
import { AskInsightIQ } from './components/AskInsightIQ';
import { AnalysisResultCard } from './components/AnalysisResultCard';
import { CleaningAuditModal } from './components/CleaningAuditModal';
import { Bookmark, Sparkles } from 'lucide-react';

import { CleaningReport, DataRow, DatasetOverview, DatasetVerdict, QueryAnswer } from './types';
import {
  buildDatasetOverview,
  generateDatasetVerdict,
  generateSuggestedQuestions,
} from './lib/processor';
import {
  initializePandasSession,
  enhanceVerdictWithAI,
  executePandasQuery,
  fetchDatasetQuestions,
} from './services/pandasAnalyst';
import { cleanDataset, sniffDelimiter } from './lib/dataCleaner';
import Papa from 'papaparse';

export const App: React.FC = () => {
  // 1. Core Dataset State
  const [cleanedRows, setCleanedRows] = useState<DataRow[] | null>(null);
  const [cleanedColumns, setCleanedColumns] = useState<string[]>([]);
  const [datasetOverview, setDatasetOverview] = useState<DatasetOverview | null>(null);
  const [datasetVerdict, setDatasetVerdict] = useState<DatasetVerdict | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // 2. Query & Analysis State (Initially null - no charts shown until user asks a question)
  const [currentAnswer, setCurrentAnswer] = useState<QueryAnswer | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState<boolean>(false);
  const [recentQueries, setRecentQueries] = useState<string[]>([]);

  // 3. Saved Charts / Pinned Dashboard (persisted so charts don't disappear)
  const [savedAnswers, setSavedAnswers] = useState<QueryAnswer[]>(() => {
    try {
      const raw = localStorage.getItem('insightiq_saved_charts');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('insightiq_saved_charts', JSON.stringify(savedAnswers));
    } catch (e) {
      console.warn('Failed to save charts to localStorage:', e);
    }
  }, [savedAnswers]);

  // 4. Modals & UI State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);
  const analysisRef = useRef<HTMLDivElement>(null);


  // Handle newly uploaded and cleaned data
  const handleDataLoaded = async (
    rows: DataRow[],
    cols: string[],
    fileName: string,
    fileSize: number,
    cleaningReport: CleaningReport
  ) => {
    setCleanedRows(rows);
    setCleanedColumns(cols);
    setCurrentAnswer(null); // Ensure NO random charts appear before user asks

    // 1. Initialize in-memory session on Python/Pandas backend for sub-20ms queries
    const datasetId = `${fileName.replace(/[^a-zA-Z0-9]/g, '_')}_${rows.length}`;
    await initializePandasSession(datasetId, rows);

    // 2. Build verified overview with cleaning audit
    const overview = buildDatasetOverview(rows, cols, fileName, cleaningReport, fileSize);
    setDatasetOverview(overview);

    // 3. Generate deterministic baseline verdict
    const baselineVerdict = generateDatasetVerdict(rows, overview);

    // 4. Enhance verdict with local Ollama AI (falls back gracefully if offline)
    const summaryPayload = {
      domain: overview.domain,
      total_records: rows.length,
      primary_metric: overview.primaryMetric,
      primary_category: overview.primaryCategory,
      top_category: baselineVerdict.importantNumbers.find((n) => n.label.startsWith('Top'))?.value,
      date_range: overview.dateRange ? `${overview.dateRange.start} to ${overview.dateRange.end}` : undefined,
    };
    const finalVerdict = await enhanceVerdictWithAI(summaryPayload, baselineVerdict);
    setDatasetVerdict(finalVerdict);

    // 5. Generate small list of useful questions based ONLY on uploaded dataset
    const aiQuestions = await fetchDatasetQuestions(rows, overview);
    const questions = aiQuestions && aiQuestions.length >= 3 ? aiQuestions : generateSuggestedQuestions(overview);
    setSuggestedQuestions(questions);
  };

  // Handle asking a plain-English question using Python/Pandas & local Ollama
  const handleAskQuestion = async (questionText: string) => {
    if (!cleanedRows || !datasetOverview) return;

    setIsQueryLoading(true);

    try {
      // Execute query through Python/Pandas calculation engine
      const answer = await executePandasQuery(questionText, cleanedRows, datasetOverview);
      setCurrentAnswer(answer);

      // Add to recent queries list
      setRecentQueries((prev) => {
        const filtered = prev.filter((q) => q.toLowerCase() !== questionText.toLowerCase());
        return [questionText, ...filtered].slice(0, 5);
      });

      // Smooth scroll to analysis result card
      setTimeout(() => {
        if (analysisRef.current) {
          analysisRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    } catch (err) {
      console.error('Error executing query:', err);
    } finally {
      setIsQueryLoading(false);
    }
  };

  const handleToggleSaveAnswer = (answer: QueryAnswer) => {
    setSavedAnswers((prev) => {
      const exists = prev.some(
        (a) => a.id === answer.id || (a.question === answer.question && a.headline === answer.headline)
      );
      if (exists) {
        return prev.filter(
          (a) => a.id !== answer.id && !(a.question === answer.question && a.headline === answer.headline)
        );
      } else {
        return [{ ...answer, isSaved: true, savedAt: Date.now() }, ...prev];
      }
    });
  };

  const handleClearAllSaved = () => {
    setSavedAnswers([]);
  };

  const handleResetToUpload = () => {
    setCleanedRows(null);
    setCleanedColumns([]);
    setDatasetOverview(null);
    setDatasetVerdict(null);
    setSuggestedQuestions([]);
    setCurrentAnswer(null);
    setRecentQueries([]);
  };

  // Auto-load sample dataset from URL query parameter (e.g. ?sample=saas, ?ask=trend, ?audit=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sampleParam = params.get('sample');
    const askParam = params.get('ask');
    const auditParam = params.get('audit');

    if (sampleParam) {
      const sampleMap: Record<string, { path: string; name: string }> = {
        saas: { path: '/samples/saas-subscriptions.csv', name: 'saas-subscriptions.csv' },
        ecommerce: { path: '/samples/ecommerce-orders.csv', name: 'ecommerce-orders.csv' },
        support: { path: '/samples/support-tickets.csv', name: 'support-tickets.csv' },
      };
      const target = sampleMap[sampleParam.toLowerCase()];
      if (target) {
        fetch(target.path)
          .then((r) => r.text())
          .then(async (text) => {
            const delimiter = sniffDelimiter(text);
            Papa.parse<DataRow>(text, {
              header: true,
              delimiter,
              skipEmptyLines: 'greedy',
              complete: async (results) => {
                if (results.data && results.data.length > 0) {
                  const { cleanedRows: cRows, cleanedColumns: cCols, report } = cleanDataset(
                    results.data,
                    results.meta.fields,
                    delimiter
                  );
                  await handleDataLoaded(cRows, cCols, target.name, text.length, report);

                  if (askParam) {
                    const question =
                      askParam === '1' || askParam === 'trend'
                        ? 'What is the monthly revenue trend and forecast?'
                        : decodeURIComponent(askParam);
                    setTimeout(() => {
                      handleAskQuestion(question);
                    }, 500);
                  }

                  if (auditParam === '1' || auditParam === 'true') {
                    setTimeout(() => {
                      setIsAuditModalOpen(true);
                    }, 300);
                  }
                }
              },
            });
          })
          .catch((err) => console.error('Failed to auto-load sample from URL:', err));
      }
    }
  }, []);

  return (
    <div className="min-h-screen text-ada-ink">
      <div className="block-container">
        {/* Navigation */}
        <Nav
          hasData={cleanedRows !== null && cleanedRows.length > 0}
          onNewUpload={handleResetToUpload}
          onOpenAudit={() => setIsAuditModalOpen(true)}
        />

        {/* Hero Banner (visible only on initial upload view) */}
        <Hero hasData={cleanedRows !== null && cleanedRows.length > 0} />

        {/* STEP 1: Upload & Clean Zone (shown when no file is loaded) */}
        {(!cleanedRows || cleanedRows.length === 0) && (
          <UploadZone onDataLoaded={handleDataLoaded} />
        )}

        {/* WORKFLOW ONCE DATA IS LOADED:
            Full Summary / Verdict → Suggested Questions → User Question → Analysis → Chart + Answer */}
        {cleanedRows && datasetOverview && datasetVerdict && (
          <>
            {/* STEP 2: ONE Clear Dataset Overview & Complete Plain-English Verdict */}
            <DatasetVerdictCard
              overview={datasetOverview}
              verdict={datasetVerdict}
              onOpenAudit={() => setIsAuditModalOpen(true)}
              onNewUpload={handleResetToUpload}
            />

            {/* STEP 3: Small list of useful questions based ONLY on uploaded dataset */}
            <SuggestedQuestions
              questions={suggestedQuestions}
              onSelectQuestion={handleAskQuestion}
            />

            {/* STEP 4: Ask Question Input */}
            <AskInsightIQ
              onAsk={handleAskQuestion}
              isLoading={isQueryLoading}
              recentQueries={recentQueries}
            />

            {/* STEP 5: Analysis (Chart + Answer generated ONLY after user asks) */}
            <div ref={analysisRef}>
              {currentAnswer && (
                <AnalysisResultCard
                  answer={currentAnswer}
                  onAskFollowUp={handleAskQuestion}
                  onSaveChart={handleToggleSaveAnswer}
                  isSaved={savedAnswers.some(
                    (a) =>
                      a.id === currentAnswer.id ||
                      (a.question === currentAnswer.question && a.headline === currentAnswer.headline)
                  )}
                />
              )}
            </div>

            {/* STEP 6: PINNED CHARTS & SAVED DASHBOARD (Charts never go away!) */}
            {savedAnswers.length > 0 && (
              <section className="my-10 pt-6 border-t-2 border-dashed border-slate-200 animate-fadeIn">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-2xs">
                      <Bookmark size={16} className="fill-white" />
                    </div>
                    <div>
                      <h3 className="font-display font-bold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                        <span>Pinned Charts & Saved Dashboard</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                          {savedAnswers.length} saved
                        </span>
                      </h3>
                      <p className="text-xs text-slate-600">
                        These charts remain pinned so you can compare multiple insights as you ask more questions.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearAllSaved}
                    className="px-3 py-1.5 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 text-xs font-semibold rounded-xl border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer shadow-2xs"
                  >
                    Clear All Saved ({savedAnswers.length})
                  </button>
                </div>

                <div className="space-y-6">
                  {savedAnswers.map((savedAns, idx) => (
                    <AnalysisResultCard
                      key={savedAns.id || `saved-${idx}`}
                      answer={savedAns}
                      onAskFollowUp={handleAskQuestion}
                      onSaveChart={handleToggleSaveAnswer}
                      isSaved={true}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Inspection & Cleaning Audit Drawer Modal */}
            <CleaningAuditModal
              isOpen={isAuditModalOpen}
              onClose={() => setIsAuditModalOpen(false)}
              rows={cleanedRows}
              columns={cleanedColumns}
              overview={datasetOverview}
              verdict={datasetVerdict}
            />
          </>
        )}

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-slate-200/80 text-center text-xs text-slate-500 space-y-1">
          <p className="font-semibold text-slate-800">
            INSIGHTiQ • Automated Data Analyst
          </p>
          <p>
            Local Offline AI & Pandas calculations. Zero telemetry or external record leak.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default App;
