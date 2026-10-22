import React from 'react';
import { UploadCloud, CheckCircle2, Search, BarChart3, Sparkles } from 'lucide-react';

interface HeroProps {
  hasData?: boolean;
}

export const Hero: React.FC<HeroProps> = ({ hasData }) => {
  if (hasData) {
    return null; // When data is active, hide the large marketing hero to keep the workspace focused!
  }

  return (
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow">Local Automated Data Analyst</div>
        <h1>
          Drop a business file.<br />
          <span className="grad">Get instant plain-English answers.</span>
        </h1>
        <p>
          INSIGHTiQ sanitizes messy spreadsheets, automatically removes duplicates and empty columns,
          and generates a complete plain-English verdict on what your numbers mean—ready for your questions.
        </p>

        {/* Clean Workflow Badges */}
        <div className="proof-row">
          <span className="proof-pill">
            <strong>01</strong> Upload & Clean
          </span>
          <span className="proof-pill">
            <strong>02</strong> Plain-English Verdict
          </span>
          <span className="proof-pill">
            <strong>03</strong> Ask & Visualize
          </span>
        </div>
      </div>
    </section>
  );
};
