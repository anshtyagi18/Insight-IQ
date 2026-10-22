"""
InsightIQ Local Ollama AI Layer
Provides local LLM intelligence for understanding questions, generating verdicts,
generating suggested questions, and explaining chart results in simple language.
Strictly sends ONLY structured calculated metadata—NEVER raw dataset rows.
"""

import json
import logging
import requests
from typing import Any, Dict, List, Optional

logger = logging.getLogger("insightiq.ollama")

OLLAMA_API = "http://127.0.0.1:11434/api/generate"
MODEL_NAME = "llama3.2:3b"


def is_ollama_available() -> bool:
    """Checks if the local Ollama instance is active and reachable."""
    try:
        resp = requests.get("http://127.0.0.1:11434/api/tags", timeout=1.5)
        return resp.status_code == 200
    except Exception:
        return False


def query_local_ollama(prompt: str, json_format: bool = False, timeout: int = 15) -> Optional[str]:
    """Queries local Ollama instance with timeout, keep-alive, and fallback protection."""
    payload = {
        "model": MODEL_NAME,
        "prompt": prompt,
        "stream": False,
        "keep_alive": "1h",
        "options": {
            "temperature": 0.2,
            "num_ctx": 2048,
            "num_thread": 4,
        },
    }
    if json_format:
        payload["format"] = "json"

    try:
        resp = requests.post(OLLAMA_API, json=payload, timeout=timeout)
        if resp.status_code == 200:
            return resp.json().get("response", "").strip()
    except Exception as e:
        logger.warning(f"Local Ollama query skipped or timed out: {e}")
    return None


def understand_question_with_ollama(
    question: str, structure: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """
    Uses local Ollama to assist in understanding complex user questions.
    Never sends raw dataset rows, only column names.
    """
    if not is_ollama_available():
        return None

    columns_str = ", ".join(structure.get("columns", []))
    prompt = f"""You are InsightIQ. Analyze this user question about a dataset with columns: [{columns_str}].
User Question: "{question}"

Identify:
1. Intent: one of ["list", "rank", "filter", "average", "total", "trend", "breakdown", "unanswerable"]
2. Target Column: which column does the user want to see or group by?
3. Metric Column: which column contains the number to measure (if any)?
4. Sort Direction: "asc" (lowest/cheapest) or "desc" (highest/best/most)

Respond strictly in JSON format:
{{
  "intent": "rank",
  "target_column": "Fruit",
  "metric_column": "Price_per_lb",
  "sort_direction": "desc",
  "can_answer": true
}}"""

    response_text = query_local_ollama(prompt, json_format=True, timeout=4)
    if response_text:
        try:
            return json.loads(response_text)
        except Exception:
            pass
    return None


def generate_verdict_with_ollama(summary_data: Dict[str, Any], fallback_verdict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Uses local Ollama to craft simple, natural human explanations for the verdict.
    Operates strictly on structured calculated summary numbers, NEVER raw rows.
    """
    if not is_ollama_available():
        return fallback_verdict

    prompt = f"""You are InsightIQ, a friendly data analyst. Explain this dataset using very simple language that even a complete beginner can understand.
Do NOT use jargon like "schema", "dimension", "measure", or "regression".

Calculated Dataset Summary (Verified Facts):
- Domain: {summary_data.get('domain', 'Business Operations')}
- Total Cleaned Records: {summary_data.get('total_records', 0):,}
- Primary Metric: {summary_data.get('primary_metric', 'Records')} (Total: {summary_data.get('total_metric', '0')}, Average per record: {summary_data.get('avg_metric', '0')})
- Primary Category: {summary_data.get('primary_category', 'Category')} (Top Leader: {summary_data.get('top_category', 'N/A')})
- Date Range: {summary_data.get('date_range', 'Not specified')}
- Trend / Growth: {summary_data.get('growth', 'Stable')}
- Peak Period: {summary_data.get('peak_period', 'N/A')}

Respond strictly with a JSON object in this format:
{{
  "about": "1-2 simple sentences explaining what this dataset tracks.",
  "major_patterns": ["Pattern 1", "Pattern 2"],
  "important_findings": ["Finding 1", "Finding 2"],
  "what_data_tells_you": "1-2 sentences with the final takeaway and actionable advice."
}}"""

    response_text = query_local_ollama(prompt, json_format=True, timeout=12)
    if response_text:
        try:
            parsed = json.loads(response_text)
            return {
                "about": parsed.get("about") or fallback_verdict["about"],
                "rowRepresentation": parsed.get("row_representation") or fallback_verdict.get("rowRepresentation"),
                "columnDescriptions": fallback_verdict.get("columnDescriptions"),
                "observations": parsed.get("observations") or fallback_verdict.get("observations"),
                "importantNumbers": fallback_verdict["importantNumbers"],  # Keep strictly calculated numbers
                "majorPatterns": parsed.get("major_patterns") or fallback_verdict.get("majorPatterns", []),
                "importantFindings": parsed.get("important_findings") or fallback_verdict.get("importantFindings", []),
                "whatDataTellsYou": parsed.get("what_data_tells_you") or fallback_verdict.get("whatDataTellsYou"),
            }
        except Exception:
            pass

    return fallback_verdict


def generate_suggested_questions_with_ollama(
    structure: Dict[str, Any], fallback_questions: List[str]
) -> List[str]:
    """
    Generates dataset-specific questions using local Ollama.
    Never invents unanswerable questions.
    """
    if not is_ollama_available():
        return fallback_questions

    prompt = f"""You are InsightIQ. Create 5 clear, interesting questions that can be answered using ONLY these columns:
Columns: {', '.join(structure.get('columns', []))}
Primary Metric: {structure.get('primary_metric')}
Primary Category: {structure.get('primary_category')}
Primary Date: {structure.get('primary_date')}

Rules:
- Questions must be simple and practical.
- Focus on: highest/lowest, monthly/yearly trends, totals, and averages.
- Do NOT ask questions about information missing from these columns.

Respond strictly with a JSON object:
{{"questions": ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]}}"""

    response_text = query_local_ollama(prompt, json_format=True, timeout=8)
    if response_text:
        try:
            parsed = json.loads(response_text)
            qs = parsed.get("questions", [])
            if isinstance(qs, list) and len(qs) >= 3:
                return qs[:6]
        except Exception:
            pass

    return fallback_questions


def interpret_results_with_ollama(
    question: str,
    calc_code: str,
    results_summary: List[Dict[str, Any]],
    chart_type: str,
    fallback_headline: str,
    fallback_explanation: str
) -> Dict[str, str]:
    """
    Generates a conversational plain-English headline and explanation for calculated results.
    Strictly receives aggregated result summaries, NEVER raw rows.
    """
    if not is_ollama_available() or not results_summary:
        return {
            "headline": fallback_headline,
            "explanation": fallback_explanation,
            "chart_reasoning": "Selected optimal visualization based on analytical intent."
        }

    prompt = f"""You are InsightIQ. Explain the following calculated data results to a business user in very simple, human language.

User Question: "{question}"
Pandas Calculation: {calc_code}
Calculated Results (Verified Facts): {json.dumps(results_summary[:6])}
Chart Type: {chart_type}

Rules:
- Headline should be bold, clear, and highlight the main winner or number.
- Explanation should be 1-2 friendly sentences explaining the context.
- Explain why this chart is useful in 1 short sentence.
- Do NOT invent numbers. Use only the provided calculated results.

Respond strictly in JSON format:
{{
  "headline": "Short punchy answer headline",
  "explanation": "Friendly explanation of what the numbers mean",
  "chart_reasoning": "Why this chart helps see the answer"
}}"""

    response_text = query_local_ollama(prompt, json_format=True, timeout=8)
    if response_text:
        try:
            parsed = json.loads(response_text)
            return {
                "headline": parsed.get("headline") or fallback_headline,
                "explanation": parsed.get("explanation") or fallback_explanation,
                "chart_reasoning": parsed.get("chart_reasoning") or "Visualizes performance distribution clearly."
            }
        except Exception:
            pass

    return {
        "headline": fallback_headline,
        "explanation": fallback_explanation,
        "chart_reasoning": "Visualizes performance distribution clearly."
    }
