import { DataRow, DatasetOverview, DatasetVerdict, QueryAnswer } from '../types';
import { processNaturalLanguageQuery } from '../lib/nlqEngine';

let currentDatasetId: string | null = null;

/**
 * Initializes or caches a dataset session on the Python/Pandas backend.
 */
export async function initializePandasSession(
  datasetId: string,
  rows: DataRow[]
): Promise<boolean> {
  currentDatasetId = datasetId;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/session/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        dataset_id: datasetId,
        records: rows.slice(0, 15000), // send up to 15k records for in-memory caching
      }),
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (e) {
    console.warn('Backend session init skipped; running in local in-browser mode:', e);
    return false;
  }
}

/**
 * Enhances the plain-English verdict using local Ollama if available.
 */
export async function enhanceVerdictWithAI(
  summaryData: Record<string, any>,
  fallbackVerdict: DatasetVerdict
): Promise<DatasetVerdict> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        dataset_id: currentDatasetId,
        summary_data: summaryData,
        fallback_verdict: fallbackVerdict,
      }),
    });

    clearTimeout(timeoutId);
    if (response.ok) {
      const data = await response.json();
      if (data && data.about) {
        return data as DatasetVerdict;
      }
    }
  } catch (e) {
    // fallback to deterministic verdict
  }

  return fallbackVerdict;
}

/**
 * Executes a question using the real Python/Pandas backend.
 * Falls back to deterministic client engine if backend is offline.
 */
export async function executePandasQuery(
  question: string,
  rows: DataRow[],
  overview: DatasetOverview
): Promise<QueryAnswer> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch('/api/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        dataset_id: currentDatasetId,
        records: currentDatasetId ? undefined : rows.slice(0, 8000),
        question,
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      return {
        id: `ans-${Date.now()}`,
        question,
        canAnswer: data.can_answer ?? true,
        headline: data.headline,
        explanation: data.explanation,
        chartType: data.chart_type,
        chartConfig: data.chart_config,
        data: data.data || [],
        xKey: data.xKey,
        yKey: data.yKey,
        yFormat: /revenue|sales|price|cost|amount|\$/i.test(question) ? 'currency' : 'number',
        calculationDetails: data.calculation_details,
        suggestedFollowUps: generateFollowUps(question, overview),
      };
    }
  } catch (err) {
    console.warn('Python backend unavailable, using deterministic in-browser calculation engine:', err);
  }

  // Fallback to client-side Pandas-equivalent calculation engine
  const clientAns = processNaturalLanguageQuery(question, rows, overview);
  return {
    ...clientAns,
    canAnswer: true,
    chartConfig: {
      title: `${clientAns.xKey || 'Category'} Breakdown`,
      xAxisLabel: clientAns.xKey || 'Group',
      yAxisLabel: clientAns.yKey || 'Value',
      reasoning: 'Visualizing metric distribution across categories.',
    },
  };
}

/**
 * Fetch dataset-specific questions from Python backend / Ollama.
 */
export async function fetchDatasetQuestions(
  rows: DataRow[],
  overview: DatasetOverview
): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch('/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        dataset_id: currentDatasetId,
        records: currentDatasetId ? undefined : rows.slice(0, 2000),
      }),
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.questions && data.questions.length > 0) {
        return data.questions;
      }
    }
  } catch (e) {
    // fallback to client generation
  }

  return [];
}

function generateFollowUps(question: string, overview: DatasetOverview): string[] {
  const { primaryCategory, primaryDate, primaryMetric } = overview;
  const qLower = question.toLowerCase();

  const followUps: string[] = [];
  if (!qLower.includes('average') && primaryMetric) {
    followUps.push(`What is the average ${primaryMetric.toLowerCase()}?`);
  }
  if (!qLower.includes('month') && !qLower.includes('year') && primaryDate) {
    followUps.push(`How did this change over time?`);
  }
  if (!qLower.includes('bottom') && primaryCategory) {
    followUps.push(`What are the bottom 3 ${primaryCategory.toLowerCase()}s?`);
  }

  return followUps.slice(0, 2);
}
