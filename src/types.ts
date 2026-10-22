export type DataRow = Record<string, any>;

export type ColumnType = 'number' | 'date' | 'category' | 'text' | 'id';

export interface ColumnProfile {
  name: string;
  originalName: string;
  type: ColumnType;
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  sampleValues: any[];
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  sum?: number;
  topValues?: Array<{ value: string; count: number; share: number }>;
}

export interface CleaningReport {
  originalRowCount: number;
  cleanedRowCount: number;
  originalColumnCount: number;
  cleanedColumnCount: number;
  removedDuplicateRows: number;
  removedEmptyRows: number;
  droppedEmptyColumns: string[];
  droppedJunkColumns: string[];
  normalizedNumericColumns: string[];
  parsedDateColumns: string[];
  imputedMissingValuesCount: number;
  renamedColumns: Array<{ from: string; to: string }>;
  detectedDelimiter?: string;
}

export interface DatasetOverview {
  fileName: string;
  fileSize?: number;
  totalRows: number;
  totalColumns: number;
  columns: string[];
  columnProfiles: ColumnProfile[];
  cleaningReport: CleaningReport;
  primaryMetric: string | null;
  primaryCategory: string | null;
  primaryDate: string | null;
  domain: string;
  dateRange?: { start: string; end: string } | null;
}

export interface ImportantNumber {
  label: string;
  value: string;
  explanation: string;
  tone?: 'positive' | 'negative' | 'neutral';
}

export interface ColumnDescription {
  name: string;
  humanName: string;
  description: string;
  type: string;
  sample?: string;
}

export interface DatasetVerdict {
  about: string;
  rowRepresentation?: string;
  columnDescriptions?: ColumnDescription[];
  observations?: string[];
  importantNumbers: ImportantNumber[];
  majorPatterns: string[];
  importantFindings: string[];
  whatDataTellsYou: string;
  aiChatText?: string;
}

export interface ChartConfig {
  title: string;
  xAxisLabel: string;
  yAxisLabel: string;
  reasoning?: string;
}

export interface QueryAnswer {
  id?: string;
  question: string;
  headline: string;
  explanation: string;
  canAnswer?: boolean;
  chartType?: 'bar' | 'horizontal-bar' | 'line' | 'area' | 'donut' | 'metric' | 'table' | 'none';
  chartConfig?: ChartConfig;
  data?: Array<Record<string, any>>;
  xKey?: string;
  yKey?: string;
  yFormat?: 'currency' | 'number' | 'percent';
  calculationDetails?: string;
  calculation?: string; // Backwards compatibility with legacy nlq
  suggestedFollowUps?: string[];
  type?: string;
  dataPoints?: Array<{ label: string; value: number }>;
  isSaved?: boolean;
  savedAt?: number;
}

export interface ColumnRoles {
  date: string | null;
  measure: string | null;
  dimension: string | null;
  identifier: string | null;
  numeric: string[];
  dimensions: string[];
}

// Legacy types preserved for backward compatibility
export interface KPI {
  label: string;
  value: string;
  context: string;
  tone: 'positive' | 'negative' | 'neutral';
}

export interface Evidence {
  kind: 'trend' | 'driver' | 'concentration' | 'anomaly' | 'volatility' | 'correlation';
  title: string;
  value: string;
  statement: string;
  calculation: string;
  tone: 'positive' | 'negative' | 'warning' | 'neutral';
  subject?: string;
}

export interface Recommendation {
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  action: string;
  rationale: string;
}

export interface Anomaly {
  period: string;
  value: number;
  expected: number;
  expectedLow: number;
  expectedHigh: number;
  direction: 'above' | 'below';
  severity: number;
}

export interface ForecastPoint {
  period: string;
  fitted: number;
  lower: number;
  upper: number;
  isForecast: boolean;
}

export interface TrendPoint {
  period: string;
  value: number;
  fitted?: number;
  anomaly?: Anomaly;
}

export interface SegmentPoint {
  segment: string;
  total: number;
  share: number;
  count: number;
  avg: number;
}

export interface WaterfallItem {
  name: string;
  delta: number;
  isStart?: boolean;
  isEnd?: boolean;
  total?: number;
}

export interface HeatmapCell {
  segment: string;
  period: string;
  value: number;
  normalized: number;
}

export interface BusinessBrief {
  headline: string;
  summary: string;
  roles: ColumnRoles;
  kpis: KPI[];
  evidence: Evidence[];
  recommendations: Recommendation[];
  trend: TrendPoint[];
  forecast: ForecastPoint[];
  segments: SegmentPoint[];
  waterfall: WaterfallItem[];
  heatmap: {
    periods: string[];
    segments: string[];
    matrix: Record<string, Record<string, number>>;
  };
  anomalies: Anomaly[];
}
