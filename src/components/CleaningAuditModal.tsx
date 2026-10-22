import React from 'react';
import Papa from 'papaparse';
import { CleaningReport, DataRow, DatasetOverview, DatasetVerdict } from '../types';
import {
  X,
  Download,
  FileText,
  CheckCircle2,
  Database,
  Trash2,
  Calendar,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';

interface CleaningAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rows: DataRow[];
  columns: string[];
  overview: DatasetOverview;
  verdict: DatasetVerdict;
}

export const CleaningAuditModal: React.FC<CleaningAuditModalProps> = ({
  isOpen,
  onClose,
  rows,
  columns,
  overview,
  verdict,
}) => {
  if (!isOpen) return null;

  const { cleaningReport, fileName } = overview;
  const previewRows = rows.slice(0, 15);

  const handleDownloadCleanedCSV = () => {
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cleaned-${fileName.toLowerCase().replace(/\.[^/.]+$/, '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadVerdictMarkdown = () => {
    let md = `# InsightIQ Dataset Report: ${fileName}\n\n`;
    md += `## What This Data Is About\n${verdict.about}\n\n`;

    md += `## Important Numbers & Meaning\n`;
    verdict.importantNumbers.forEach((n) => {
      md += `- **${n.label}**: ${n.value}\n  ${n.explanation}\n`;
    });
    md += `\n`;

    md += `## Major Patterns\n`;
    verdict.majorPatterns.forEach((p) => {
      md += `- ${p}\n`;
    });
    md += `\n`;

    md += `## Important Findings\n`;
    verdict.importantFindings.forEach((f) => {
      md += `- ${f}\n`;
    });
    md += `\n`;

    md += `## What The Data Is Telling You\n${verdict.whatDataTellsYou}\n\n`;

    md += `## Data Cleaning & Processing Audit\n`;
    md += `- Original Rows: ${cleaningReport.originalRowCount.toLocaleString()}\n`;
    md += `- Cleaned Rows: ${cleaningReport.cleanedRowCount.toLocaleString()}\n`;
    md += `- Removed Duplicate Rows: ${cleaningReport.removedDuplicateRows.toLocaleString()}\n`;
    md += `- Removed Empty Rows: ${cleaningReport.removedEmptyRows.toLocaleString()}\n`;
    if (cleaningReport.droppedJunkColumns.length > 0) {
      md += `- Dropped Junk/URL Columns: ${cleaningReport.droppedJunkColumns.join(', ')}\n`;
    }
    if (cleaningReport.normalizedNumericColumns.length > 0) {
      md += `- Normalized Numeric Columns: ${cleaningReport.normalizedNumericColumns.join(', ')}\n`;
    }
    if (cleaningReport.parsedDateColumns.length > 0) {
      md += `- Standardized Date Columns: ${cleaningReport.parsedDateColumns.join(', ')}\n`;
    }

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `verdict-${fileName.toLowerCase().replace(/\.[^/.]+$/, '')}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fadeIn">
      <div className="w-full max-w-3xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slideLeft">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-ada-line bg-slate-50">
          <div className="flex items-center gap-2.5">
            <Database size={20} className="text-ada-accent" />
            <div>
              <h2 className="font-display font-bold text-base text-ada-ink">
                Data Cleaning & Inspection
              </h2>
              <p className="text-xs text-ada-muted">
                Audit trail of automatic sanitation performed on {fileName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cleaning Highlights Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] text-ada-muted font-bold uppercase tracking-wider">
                Original Rows
              </div>
              <div className="text-lg font-bold text-slate-700">
                {cleaningReport.originalRowCount.toLocaleString()}
              </div>
            </div>

            <div className="bg-emerald-50 p-3.5 rounded-xl border border-emerald-200">
              <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
                Cleaned Rows
              </div>
              <div className="text-lg font-bold text-emerald-800">
                {cleaningReport.cleanedRowCount.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] text-ada-muted font-bold uppercase tracking-wider">
                Duplicates Removed
              </div>
              <div className="text-lg font-bold text-slate-800">
                {cleaningReport.removedDuplicateRows.toLocaleString()}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="text-[10px] text-ada-muted font-bold uppercase tracking-wider">
                Junk / Blank Dropped
              </div>
              <div className="text-lg font-bold text-slate-800">
                {cleaningReport.droppedJunkColumns.length + cleaningReport.droppedEmptyColumns.length}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleDownloadCleanedCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-ada-ink hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <Download size={14} />
              <span>Download Cleaned CSV</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadVerdictMarkdown}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-ada-line rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer"
            >
              <FileText size={14} />
              <span>Export Plain-English Verdict (.md)</span>
            </button>
          </div>

          {/* Cleaning Log Details */}
          <div className="space-y-3">
            <h3 className="font-display font-bold text-xs uppercase text-ada-muted tracking-wider">
              Sanitation Actions Performed
            </h3>

            <div className="space-y-2 text-xs text-slate-700">
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900">Delimiter & Structure: </span>
                  {cleaningReport.detectedDelimiter
                    ? `Detected delimiter "${cleaningReport.detectedDelimiter}" and standardized column layout.`
                    : 'Excel sheet converted to tabular matrix.'}
                </div>
              </div>

              {cleaningReport.removedDuplicateRows > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">Duplicate Rows: </span>
                    Removed {cleaningReport.removedDuplicateRows.toLocaleString()} identical duplicate records.
                  </div>
                </div>
              )}

              {cleaningReport.droppedJunkColumns.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">Junk / URL Columns: </span>
                    Removed {cleaningReport.droppedJunkColumns.join(', ')} to keep your analysis clean.
                  </div>
                </div>
              )}

              {cleaningReport.normalizedNumericColumns.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">Numeric Sanitization: </span>
                    Cleaned currencies, commas, and percentage signs in{' '}
                    {cleaningReport.normalizedNumericColumns.join(', ')}.
                  </div>
                </div>
              )}

              {cleaningReport.parsedDateColumns.length > 0 && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-semibold text-slate-900">Date Standardization: </span>
                    Standardized dates in {cleaningReport.parsedDateColumns.join(', ')} into uniform YYYY-MM-DD format.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Cleaned Records Preview Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-display font-bold text-xs uppercase text-ada-muted tracking-wider">
                Cleaned Data Preview (First {previewRows.length} rows)
              </h3>
              <span className="text-[11px] text-ada-muted">{columns.length} columns active</span>
            </div>

            <div className="overflow-x-auto border border-ada-line rounded-xl max-h-72">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 border-b border-ada-line sticky top-0">
                  <tr>
                    {columns.map((c) => (
                      <th key={c} className="p-2.5 font-bold text-slate-700 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {columns.map((c) => (
                        <td key={c} className="p-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                          {r[c] !== null && r[c] !== undefined ? String(r[c]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-ada-line bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
};
