import React from 'react';
import { UploadCloud, FileText, Sparkles, ExternalLink } from 'lucide-react';

interface NavProps {
  hasData?: boolean;
  onNewUpload?: () => void;
  onOpenAudit?: () => void;
}

export const Nav: React.FC<NavProps> = ({ hasData, onNewUpload, onOpenAudit }) => {
  return (
    <nav className="ada-nav" aria-label="Primary navigation">
      <div className="ada-brand">
        <div className="ada-mark">IQ</div>
        <div>
          <div className="ada-wordmark">INSIGHTiQ</div>
          <div className="ada-nav-note">Automated Data Analyst • Plain-English Intelligence</div>
        </div>
      </div>

      <div className="nav-actions">
        {hasData && (
          <>
            <button
              type="button"
              onClick={onNewUpload}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <UploadCloud size={13} />
              <span>Upload New File</span>
            </button>
            <button
              type="button"
              onClick={onOpenAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full bg-white hover:bg-ada-accent-soft text-ada-accent border border-ada-line hover:border-ada-accent/30 transition-colors cursor-pointer"
            >
              <FileText size={13} />
              <span>Audit & Export</span>
            </button>
          </>
        )}

        <span className="trust-chip hidden sm:inline-flex">
          <span className="trust-dot"></span>
          100% In-Browser & Local
        </span>
      </div>
    </nav>
  );
};
