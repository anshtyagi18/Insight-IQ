import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LabelList,
} from 'recharts';
import { QueryAnswer } from '../types';
import { formatFriendlyNumber } from '../lib/processor';
import {
  BarChart2,
  TrendingUp,
  PieChart as PieIcon,
  Table as TableIcon,
  Download,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  AlertTriangle,
  Bookmark,
  Info,
} from 'lucide-react';
import Papa from 'papaparse';

interface AnalysisResultCardProps {
  answer: QueryAnswer;
  onAskFollowUp?: (question: string) => void;
  onSaveChart?: (answer: QueryAnswer) => void;
  isSaved?: boolean;
}

const PALETTE = [
  '#635bff',
  '#0e8f6e',
  '#d6455d',
  '#b5761b',
  '#8b5cf6',
  '#3b82f6',
  '#ec4899',
  '#10b981',
  '#f59e0b',
  '#64748b',
];

export const AnalysisResultCard: React.FC<AnalysisResultCardProps> = ({
  answer,
  onAskFollowUp,
  onSaveChart,
  isSaved = false,
}) => {
  const [activeView, setActiveView] = useState<'chart' | 'table'>('chart');
  const [selectedChartType, setSelectedChartType] = useState<string>(answer.chartType || 'bar');

  // Sync state whenever answer changes so previous metric mode doesn't break charts
  useEffect(() => {
    setSelectedChartType(answer.chartType || 'bar');
    setActiveView('chart');
  }, [answer.id, answer.question, answer.chartType]);

  const {
    question,
    headline,
    explanation,
    xKey,
    yKey,
    calculationDetails,
    suggestedFollowUps,
    chartConfig,
    canAnswer,
  } = answer;

  const data = answer.data || [];

  // Determine true category key (e.g. 'Fruit', 'Category', 'Channel')
  const categoryKey =
    xKey ||
    Object.keys(data[0] || {}).find(
      (k) => !['Value', 'Share', 'Count', 'FormattedValue', 'Records'].includes(k)
    ) ||
    Object.keys(data[0] || {})[0] ||
    'Category';

  // Only render metric card view if data actually has explicit Metric stat labels
  const isTrueScalarMetric =
    selectedChartType === 'metric' &&
    data.length > 0 &&
    data[0]?.Metric !== undefined;

  // If selectedChartType was 'metric' but data is categorical (e.g. 5 fruits), force 'bar'
  const currentChartType =
    selectedChartType === 'metric' && !isTrueScalarMetric
      ? 'bar'
      : selectedChartType || answer.chartType || 'bar';

  const handleExportResultCSV = () => {
    if (!data || data.length === 0) return;
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `query-result-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // If question cannot be answered from the dataset
  if (canAnswer === false) {
    return (
      <div className="my-6 p-6 bg-amber-50/90 border border-amber-200 rounded-3xl shadow-xs animate-fadeIn">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200/70 text-amber-800 rounded-full text-xs font-bold uppercase tracking-wider">
              <span>Unanswerable Question</span>
            </div>
            <h3 className="text-lg font-display font-bold text-amber-950">
              {headline}
            </h3>
            <p className="text-sm text-amber-900/90 leading-relaxed">
              {explanation}
            </p>
            <div className="pt-2 text-xs text-amber-800 font-medium">
              💡 <strong>Tip:</strong> Try selecting one of the suggested questions above, or ask about fields that exist in your uploaded data.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const chartTitle = chartConfig?.title || `${categoryKey} Analysis`;
  const xAxisLabel = chartConfig?.xAxisLabel || categoryKey;
  const yAxisLabel = chartConfig?.yAxisLabel || yKey || 'Value';

  return (
    <div className="my-6 bg-white rounded-3xl border border-ada-line shadow-sm overflow-hidden animate-fadeIn">
      {/* 1. Header & Plain-English Answer */}
      <div className="p-6 bg-slate-50/70 border-b border-ada-line">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-ada-accent-soft text-ada-accent rounded-full text-xs font-bold">
              <Sparkles size={13} />
              <span>InsightIQ Result</span>
            </span>

            {chartConfig?.reasoning && (
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-200/70 text-slate-700 rounded-full text-xs font-semibold">
                <Info size={12} className="text-slate-500" />
                <span>{chartConfig.reasoning}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Save / Pin Chart Button */}
            {onSaveChart && (
              <button
                type="button"
                onClick={() => onSaveChart(answer)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  isSaved
                    ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300'
                }`}
                title="Pin this chart to your dashboard so it stays visible"
              >
                <Bookmark
                  size={14}
                  className={isSaved ? 'fill-amber-600 text-amber-600' : 'text-slate-500'}
                />
                <span>{isSaved ? 'Pinned to Saved' : 'Save Chart'}</span>
              </button>
            )}

            {/* View & Chart Switcher */}
            {!isTrueScalarMetric && (
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-ada-line shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    setActiveView('chart');
                    setSelectedChartType('bar');
                  }}
                  title="Vertical Bar Chart"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'chart' && currentChartType === 'bar'
                      ? 'bg-ada-accent text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart2 size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveView('chart');
                    setSelectedChartType('horizontal-bar');
                  }}
                  title="Horizontal Bar Chart"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'chart' && currentChartType === 'horizontal-bar'
                      ? 'bg-ada-accent text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <BarChart2 size={15} className="rotate-90" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveView('chart');
                    setSelectedChartType('line');
                  }}
                  title="Line / Trend Chart"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'chart' && (currentChartType === 'line' || currentChartType === 'area')
                      ? 'bg-ada-accent text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <TrendingUp size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveView('chart');
                    setSelectedChartType('donut');
                  }}
                  title="Donut / Distribution"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'chart' && currentChartType === 'donut'
                      ? 'bg-ada-accent text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <PieIcon size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveView('table')}
                  title="Table View"
                  className={`p-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeView === 'table'
                      ? 'bg-ada-accent text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <TableIcon size={15} />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="text-xs text-ada-muted font-medium mb-1">
          Question: <span className="text-slate-900 font-semibold italic">"{question}"</span>
        </div>

        {/* Large Plain-English Headline Answer */}
        <h3 className="text-lg sm:text-2xl font-display font-bold text-ada-ink leading-snug">
          {headline}
        </h3>

        {/* Conversational Explanation */}
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-4xl">
          {explanation}
        </p>
      </div>

      {/* 2. Interactive Chart / Visualizations */}
      <div className="p-6">
        {/* Chart Title & Axis Context */}
        {activeView === 'chart' && !isTrueScalarMetric && (
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-sm font-display font-bold text-slate-800">
              {chartTitle}
            </h4>
            <div className="text-xs text-ada-muted">
              X: <span className="font-semibold text-slate-700">{xAxisLabel}</span> • Y:{' '}
              <span className="font-semibold text-slate-700">{yAxisLabel}</span>
            </div>
          </div>
        )}

        {activeView === 'chart' ? (
          <div>
            {/* SCENARIO 1: TRUE SCALAR METRIC CARD DISPLAY */}
            {isTrueScalarMetric ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 my-2">
                {data.map((m, idx) => (
                  <div
                    key={idx}
                    className="p-5 rounded-2xl bg-slate-50 border border-slate-200 text-center"
                  >
                    <div className="text-xs font-bold text-ada-muted uppercase tracking-wider mb-1">
                      {m.Metric}
                    </div>
                    <div className="text-3xl font-display font-bold text-ada-accent">
                      {m.FormattedValue || formatFriendlyNumber(m.Value)}
                    </div>
                  </div>
                ))}
              </div>
            ) : currentChartType === 'donut' ? (
              /* SCENARIO 2: DONUT / PIE CHART */
              <div className="h-80 w-full flex flex-col md:flex-row items-center justify-center gap-6">
                <div className="h-72 w-72 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data}
                        dataKey={yKey || 'Value'}
                        nameKey={categoryKey}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {data.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any) => [formatFriendlyNumber(Number(val)), yAxisLabel]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut Legend */}
                <div className="flex flex-col gap-2 max-h-64 overflow-y-auto w-full max-w-sm pr-2 text-xs">
                  {data.map((item, idx) => {
                    const label = String(item[categoryKey] || 'Item');
                    const val = Number(item[yKey || 'Value'] || 0);
                    const share = item.Share !== undefined ? `${item.Share}%` : '';
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                          />
                          <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                            {label}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900">{formatFriendlyNumber(val)}</span>
                          {share && <span className="ml-1 text-ada-muted">({share})</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : currentChartType === 'line' || currentChartType === 'area' ? (
              /* SCENARIO 3: AREA / LINE CHART */
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data} margin={{ top: 20, right: 30, left: 15, bottom: 25 }}>
                    <defs>
                      <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#635bff" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#635bff" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 17, 22, 0.06)" />
                    <XAxis
                      dataKey={categoryKey}
                      tick={{ fontSize: 11, fill: '#667085' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#667085' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => formatFriendlyNumber(val)}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatFriendlyNumber(Number(val)), yAxisLabel]}
                    />
                    <Area
                      type="monotone"
                      name={yAxisLabel}
                      dataKey={yKey || 'Value'}
                      stroke="#635bff"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#areaGradient)"
                    >
                      <LabelList
                        dataKey={yKey || 'Value'}
                        position="top"
                        formatter={(val: any) => formatFriendlyNumber(Number(val))}
                        style={{ fill: '#475569', fontSize: 11, fontWeight: 600 }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : currentChartType === 'horizontal-bar' ? (
              /* SCENARIO 4: HORIZONTAL BAR CHART */
              <div className="h-84 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 15, right: 45, left: 80, bottom: 15 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(15, 17, 22, 0.06)" />
                    <XAxis
                      type="number"
                      tick={{ fontSize: 11, fill: '#667085' }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickFormatter={(val) => formatFriendlyNumber(val)}
                    />
                    <YAxis
                      type="category"
                      dataKey={categoryKey}
                      tick={{ fontSize: 12, fill: '#0e0f13', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatFriendlyNumber(Number(val)), yAxisLabel]}
                    />
                    <Bar dataKey={yKey || 'Value'} name={yAxisLabel} radius={[0, 6, 6, 0]}>
                      <LabelList
                        dataKey={yKey || 'Value'}
                        position="right"
                        formatter={(val: any) => formatFriendlyNumber(Number(val))}
                        style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                      />
                      {data.map((_, index) => (
                        <Cell key={`bar-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              /* SCENARIO 5: STANDARD VERTICAL BAR CHART */
              <div className="h-84 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 25, right: 25, left: 15, bottom: 35 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(15, 17, 22, 0.06)" />
                    <XAxis
                      dataKey={categoryKey}
                      tick={{ fontSize: 12, fill: '#1e293b', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={{ stroke: '#cbd5e1' }}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => formatFriendlyNumber(val)}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatFriendlyNumber(Number(val)), yAxisLabel]}
                    />
                    <Bar dataKey={yKey || 'Value'} name={yAxisLabel} radius={[6, 6, 0, 0]}>
                      <LabelList
                        dataKey={yKey || 'Value'}
                        position="top"
                        formatter={(val: any) => formatFriendlyNumber(Number(val))}
                        style={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
                      />
                      {data.map((_, index) => (
                        <Cell key={`vbar-${index}`} fill={PALETTE[index % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        ) : (
          /* TABULAR RESULT VIEW */
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-ada-muted uppercase tracking-wider">
                Calculated Table ({data.length} records)
              </span>
              <button
                type="button"
                onClick={handleExportResultCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <Download size={13} />
                <span>Export Result CSV</span>
              </button>
            </div>

            <div className="overflow-x-auto border border-ada-line rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-ada-line text-slate-700">
                  <tr>
                    {data.length > 0 &&
                      Object.keys(data[0]).map((col) => (
                        <th key={col} className="p-3 font-bold whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50">
                      {Object.keys(row).map((col) => (
                        <td key={col} className="p-3 font-medium text-slate-800 whitespace-nowrap">
                          {typeof row[col] === 'number'
                            ? formatFriendlyNumber(row[col])
                            : String(row[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer: Transparent Python/Pandas Calculation & Follow-up suggestions */}
      <div className="p-5 bg-slate-50 border-t border-ada-line flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-2 text-slate-600">
          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
          <span className="font-mono text-[11px] bg-white px-2.5 py-1 rounded-md border border-slate-200 text-slate-800">
            {calculationDetails || 'Pandas: Aggregated calculation'}
          </span>
        </div>

        {suggestedFollowUps && suggestedFollowUps.length > 0 && onAskFollowUp && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-ada-muted text-[11px] uppercase tracking-wider mr-1">
              Follow-up:
            </span>
            {suggestedFollowUps.map((fQ, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onAskFollowUp(fQ)}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-ada-accent-soft text-slate-700 hover:text-ada-accent border border-ada-line hover:border-ada-accent/30 rounded-lg text-[11px] font-semibold transition-all cursor-pointer"
              >
                <span>{fQ}</span>
                <ArrowRight size={11} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
