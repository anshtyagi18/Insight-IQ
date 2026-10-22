import io
import json
import hashlib
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pandas as pd

from insightiq_engine import (
    analyze_dataframe_structure,
    generate_dataset_questions,
    execute_pandas_query,
)
from ollama_service import (
    is_ollama_available,
    generate_verdict_with_ollama,
    generate_suggested_questions_with_ollama,
    interpret_results_with_ollama,
)

app = FastAPI(title="InsightIQ Analytics Engine", version="2.0.0")

# Enable CORS for Vite dev server and local clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory DataFrame session cache to avoid duplicate uploads/processing
session_cache: Dict[str, pd.DataFrame] = {}


class SessionInitRequest(BaseModel):
    dataset_id: str
    records: List[Dict[str, Any]]


class VerdictRequest(BaseModel):
    dataset_id: Optional[str] = None
    summary_data: Dict[str, Any]
    fallback_verdict: Dict[str, Any]


class QuestionsRequest(BaseModel):
    dataset_id: Optional[str] = None
    records: Optional[List[Dict[str, Any]]] = None


class QueryRequest(BaseModel):
    dataset_id: Optional[str] = None
    records: Optional[List[Dict[str, Any]]] = None
    question: str


@app.get("/api/health")
def health_check():
    ollama_ready = is_ollama_available()
    return {
        "status": "ok",
        "engine": "Python/Pandas",
        "pandas_version": pd.__version__,
        "ollama_connected": ollama_ready,
        "model": "llama3.2:3b" if ollama_ready else "offline-fallback",
    }


@app.post("/api/session/init")
def init_session(req: SessionInitRequest):
    """Caches cleaned records in-memory so subsequent queries execute in milliseconds."""
    if not req.records:
        raise HTTPException(status_code=400, detail="No records provided.")
    df = pd.DataFrame(req.records)
    session_cache[req.dataset_id] = df
    return {
        "status": "cached",
        "dataset_id": req.dataset_id,
        "cached_rows": len(df),
        "columns": list(df.columns),
    }


@app.post("/api/verdict")
def enhance_verdict(req: VerdictRequest):
    """Generates plain-English verdict using local Ollama if available."""
    enhanced = generate_verdict_with_ollama(req.summary_data, req.fallback_verdict)
    return enhanced


@app.post("/api/questions")
def get_questions(req: QuestionsRequest):
    df = None
    if req.dataset_id and req.dataset_id in session_cache:
        df = session_cache[req.dataset_id]
    elif req.records:
        df = pd.DataFrame(req.records)

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No active dataset available.")

    structure = analyze_dataframe_structure(df)
    deterministic_questions = generate_dataset_questions(df)

    # Enhance with local Ollama if available
    questions = generate_suggested_questions_with_ollama(structure, deterministic_questions)
    return {"questions": questions}


@app.post("/api/query")
def run_query(req: QueryRequest):
    df = None
    if req.dataset_id and req.dataset_id in session_cache:
        df = session_cache[req.dataset_id]
    elif req.records:
        df = pd.DataFrame(req.records)

    if df is None or df.empty:
        raise HTTPException(status_code=400, detail="No active dataset available.")
    if not req.question:
        raise HTTPException(status_code=400, detail="No question provided.")

    # 1. Perform actual calculation strictly with Python/Pandas
    result = execute_pandas_query(df, req.question)

    # 2. If answerable and Ollama is available, use local Ollama to explain results in simple language
    if result.get("can_answer") and result.get("data") and is_ollama_available():
        interpretation = interpret_results_with_ollama(
            question=req.question,
            calc_code=result.get("calculation_details", ""),
            results_summary=result.get("data", [])[:6],
            chart_type=result.get("chart_type", "bar"),
            fallback_headline=result.get("headline", ""),
            fallback_explanation=result.get("explanation", ""),
        )
        result["headline"] = interpretation.get("headline", result["headline"])
        result["explanation"] = interpretation.get("explanation", result["explanation"])
        if result.get("chart_config"):
            result["chart_config"]["reasoning"] = interpretation.get(
                "chart_reasoning", result["chart_config"].get("reasoning", "")
            )

    return result


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
