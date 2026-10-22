import React, { useRef, useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { UploadCloud, Sparkles, AlertCircle, ShieldCheck, CheckCircle2, FileSpreadsheet, Loader2 } from 'lucide-react';
import { CleaningReport, DataRow } from '../types';
import { cleanDataset, sniffDelimiter } from '../lib/dataCleaner';

interface UploadZoneProps {
  onDataLoaded: (
    cleanedRows: DataRow[],
    cleanedColumns: string[],
    fileName: string,
    fileSize: number,
    report: CleaningReport
  ) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onDataLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps = [
    'Reading file & sniffing delimiter',
    'Cleaning duplicates, blank rows & junk columns',
    'Normalizing currencies, dates & numbers',
    'Generating plain-English verdict with local AI',
  ];

  const handleFileProcess = async (file: File) => {
    setErrorMessage(null);
    setStepIndex(0);
    setProcessingStatus('Reading file bytes and detecting structure...');

    const ext = file.name.split('.').pop()?.toLowerCase();

    try {
      if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
        const text = await file.text();
        const delimiter = sniffDelimiter(text);

        setStepIndex(1);
        setProcessingStatus('Parsing rows and cleaning empty records...');

        Papa.parse<DataRow>(text, {
          header: true,
          delimiter: delimiter,
          dynamicTyping: false,
          skipEmptyLines: 'greedy',
          complete: (results) => {
            if (!results.data || results.data.length === 0) {
              setErrorMessage('The uploaded CSV file is empty or could not be read.');
              setStepIndex(null);
              setProcessingStatus(null);
              return;
            }

            setStepIndex(2);
            setProcessingStatus('Removing duplicate rows, sanitizing numbers & dates...');

            setTimeout(() => {
              const { cleanedRows, cleanedColumns, report } = cleanDataset(
                results.data,
                results.meta.fields,
                delimiter
              );

              if (cleanedRows.length === 0) {
                setErrorMessage('No valid data records remained after filtering empty rows.');
                setStepIndex(null);
                setProcessingStatus(null);
                return;
              }

              setStepIndex(3);
              setProcessingStatus('Running Pandas analysis and generating verdict...');

              setTimeout(() => {
                onDataLoaded(cleanedRows, cleanedColumns, file.name, file.size, report);
                setStepIndex(null);
                setProcessingStatus(null);
              }, 150);
            }, 100);
          },
          error: (err: any) => {
            setErrorMessage(`Failed to parse CSV: ${err.message}`);
            setStepIndex(null);
            setProcessingStatus(null);
          },
        });
      } else if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm') {
        setStepIndex(1);
        setProcessingStatus('Reading Excel sheets and cell formats...');
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Workbook contains no worksheets.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        setStepIndex(2);
        setProcessingStatus('Converting cells to clean matrix...');
        const rawJson = XLSX.utils.sheet_to_json<DataRow>(worksheet, {
          defval: null,
          raw: false,
        });

        if (!rawJson || rawJson.length === 0) {
          throw new Error('First worksheet contains no data records.');
        }

        setTimeout(() => {
          const { cleanedRows, cleanedColumns, report } = cleanDataset(rawJson);

          if (cleanedRows.length === 0) {
            setErrorMessage('No valid records remained after cleaning.');
            setStepIndex(null);
            setProcessingStatus(null);
            return;
          }

          setStepIndex(3);
          setProcessingStatus('Generating plain-English verdict with local AI...');

          setTimeout(() => {
            onDataLoaded(cleanedRows, cleanedColumns, file.name, file.size, report);
            setStepIndex(null);
            setProcessingStatus(null);
          }, 150);
        }, 100);
      } else {
        setErrorMessage('Unsupported file format. Please upload a .csv or .xlsx Excel file.');
        setStepIndex(null);
        setProcessingStatus(null);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while reading the file.');
      setStepIndex(null);
      setProcessingStatus(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleLoadSample = async (samplePath: string, sampleName: string) => {
    try {
      setErrorMessage(null);
      setStepIndex(0);
      setProcessingStatus(`Loading sample ${sampleName}...`);
      const resp = await fetch(samplePath);
      if (!resp.ok) throw new Error(`Could not fetch sample ${sampleName}`);
      const text = await resp.text();
      const delimiter = sniffDelimiter(text);

      setStepIndex(1);
      setProcessingStatus('Parsing rows and cleaning empty records...');

      Papa.parse<DataRow>(text, {
        header: true,
        delimiter: delimiter,
        dynamicTyping: false,
        skipEmptyLines: 'greedy',
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            setErrorMessage('The sample file is empty or could not be read.');
            setStepIndex(null);
            setProcessingStatus(null);
            return;
          }

          setStepIndex(2);
          setProcessingStatus('Removing duplicate rows, sanitizing numbers & dates...');

          setTimeout(() => {
            const { cleanedRows, cleanedColumns, report } = cleanDataset(
              results.data,
              results.meta.fields,
              delimiter
            );

            setStepIndex(3);
            setProcessingStatus('Running Pandas analysis and generating verdict...');

            setTimeout(() => {
              onDataLoaded(cleanedRows, cleanedColumns, sampleName, text.length, report);
              setStepIndex(null);
              setProcessingStatus(null);
            }, 150);
          }, 100);
        },
        error: (err: any) => {
          setErrorMessage(`Failed to parse sample: ${err.message}`);
          setStepIndex(null);
          setProcessingStatus(null);
        },
      });
    } catch (err: any) {
      setErrorMessage(`Failed to load sample dataset: ${err.message}`);
      setStepIndex(null);
      setProcessingStatus(null);
    }
  };

  return (
    <div className="max-w-2xl mx-auto my-10 animate-fadeIn">
      {/* Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !stepIndex && fileInputRef.current?.click()}
        className={`relative p-10 sm:p-12 rounded-3xl border-2 border-dashed transition-all text-center ${
          stepIndex !== null
            ? 'border-ada-accent bg-ada-accent-soft/30 cursor-wait'
            : isDragging
            ? 'border-ada-accent bg-ada-accent-soft/40 shadow-xl scale-[1.01] cursor-pointer'
            : 'border-slate-300 hover:border-ada-accent/70 bg-white/95 hover:bg-white shadow-sm hover:shadow-md cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.tsv,.xlsm"
          className="hidden"
          disabled={stepIndex !== null}
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center gap-3.5 pointer-events-none">
          {stepIndex !== null ? (
            <div className="w-16 h-16 rounded-2xl bg-ada-accent text-white flex items-center justify-center shadow-lg animate-bounce">
              <Loader2 size={30} className="animate-spin" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-ada-accent-soft text-ada-accent flex items-center justify-center shadow-inner">
              <UploadCloud size={32} />
            </div>
          )}

          <div>
            <h2 className="text-xl font-display font-bold text-slate-900 mb-1">
              {stepIndex !== null ? 'Processing Your Data' : 'Upload your data file'}
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              {stepIndex !== null ? (
                <span className="font-semibold text-ada-accent">{processingStatus}</span>
              ) : (
                <>
                  Drag & drop your <span className="font-semibold text-slate-800">CSV</span> or{' '}
                  <span className="font-semibold text-slate-800">Excel</span> file here, or{' '}
                  <span className="text-ada-accent font-semibold underline underline-offset-2">browse files</span>.
                </>
              )}
            </p>
          </div>

          {/* Progress Steps Indicator during processing */}
          {stepIndex !== null && (
            <div className="w-full max-w-md mt-4 space-y-2 bg-white/80 p-4 rounded-2xl border border-slate-200 text-left">
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-ada-accent h-1.5 transition-all duration-300 rounded-full"
                  style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
              <div className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Step {stepIndex + 1} of {steps.length}</span>
                <span className="text-ada-accent">{steps[stepIndex]}</span>
              </div>
            </div>
          )}

          {/* Clean Feature Badges (when idle) */}
          {stepIndex === null && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg font-medium">
                <CheckCircle2 size={13} className="text-emerald-600" /> Auto-clean duplicates
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg font-medium">
                <CheckCircle2 size={13} className="text-emerald-600" /> Date & number formatting
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200/80 rounded-lg font-medium">
                <CheckCircle2 size={13} className="text-emerald-600" /> Local AI verdict
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Quick Try Sample Datasets */}
      <div className="mt-6 text-center">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
          Or try a pre-loaded sample dataset
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            id="sample-saas"
            onClick={() => handleLoadSample('/samples/saas-subscriptions.csv', 'saas-subscriptions.csv')}
            disabled={stepIndex !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-ada-accent text-xs font-semibold rounded-xl border border-slate-200/90 hover:border-ada-accent/50 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-ada-accent" />
            <span>SaaS Subscriptions</span>
          </button>
          <button
            type="button"
            id="sample-ecommerce"
            onClick={() => handleLoadSample('/samples/ecommerce-orders.csv', 'ecommerce-orders.csv')}
            disabled={stepIndex !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-ada-accent text-xs font-semibold rounded-xl border border-slate-200/90 hover:border-ada-accent/50 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-ada-accent" />
            <span>Ecommerce Orders</span>
          </button>
          <button
            type="button"
            id="sample-support"
            onClick={() => handleLoadSample('/samples/support-tickets.csv', 'support-tickets.csv')}
            disabled={stepIndex !== null}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-ada-accent text-xs font-semibold rounded-xl border border-slate-200/90 hover:border-ada-accent/50 shadow-2xs transition-all hover:scale-[1.02] cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-ada-accent" />
            <span>Support Tickets</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center gap-3 shadow-xs">
          <AlertCircle size={18} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Privacy Guarantee */}
      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <ShieldCheck size={14} className="text-emerald-600" />
        <span>100% In-Browser & Local Offline AI • Your records never leave your computer</span>
      </div>
    </div>
  );
};

