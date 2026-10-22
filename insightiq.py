import io
import json
import re
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import requests
import streamlit as st

# Application Layout & UI Configuration
st.set_page_config(
    page_title="INSIGHTiQ — Autonomous Data Studio",
    page_icon="📊",
    layout="wide",
)

st.title("📊 INSIGHTiQ")
st.caption(
    "Local Autonomous Data Analytics & Visual Intelligence • Powered by Meta"
    " Llama"
)

# Ollama Endpoint Configuration
OLLAMA_API = "http://localhost:11434/api/generate"
# Lightweight, high-speed model optimized for 8 GB RAM systems
MODEL_NAME = "llama3.2:3b"


def query_local_llm(prompt: str) -> str:
  """Sends an isolated generation query to the local Ollama instance."""
  payload = {
      "model": MODEL_NAME,
      "prompt": prompt,
      "stream": False,
      "options": {
          "temperature": 0.1,
          "num_ctx": 1536,  # Constrained context window to prevent memory saturation
          "num_thread": 3,  # Leaves system threads free for OS stability
      },
  }
  try:
    response = requests.post(OLLAMA_API, json=payload, timeout=60)
    response.raise_for_status()
    return response.json().get("response", "")
  except requests.exceptions.RequestException as err:
    return f"ERROR: Failed to connect to Ollama. Verify that the Ollama service is active. Details: {err}"


# Data Source Sidebar
st.sidebar.header("Data Ingestion")
uploaded_file = st.sidebar.file_uploader(
    "Select a dataset", type=["csv", "xlsx", "json"]
)

if uploaded_file:
  # Load dataset into memory
  try:
    if uploaded_file.name.endswith(".csv"):
      raw_df = pd.read_csv(uploaded_file)
    elif uploaded_file.name.endswith(".xlsx"):
      raw_df = pd.read_excel(uploaded_file)
    elif uploaded_file.name.endswith(".json"):
      raw_df = pd.read_json(uploaded_file)
  except Exception as read_err:
    st.error(f"Error reading file: {read_err}")
    st.stop()

  # Manage active session state
  if (
      "active_df" not in st.session_state
      or st.session_state.get("current_filename") != uploaded_file.name
  ):
    st.session_state["active_df"] = raw_df.copy()
    st.session_state["current_filename"] = uploaded_file.name

  active_df = st.session_state["active_df"]

  # Dataset Metrics Header
  m1, m2, m3, m4 = st.columns(4)
  m1.metric("Total Records", f"{active_df.shape[0]:,}")
  m2.metric("Total Attributes", active_df.shape[1])
  m3.metric("Missing Values", f"{int(active_df.isna().sum().sum()):,}")
  m4.metric("Duplicate Rows", f"{int(active_df.duplicated().sum()):,}")

  st.write("---")

  # Split Workspace
  preview_col, prompt_col = st.columns([1.1, 0.9])

  with preview_col:
    st.subheader("Dataset Preview")
    st.dataframe(active_df.head(10), use_container_width=True)

  with prompt_col:
    st.subheader("Ask INSIGHTiQ")
    user_instruction = st.text_area(
        "Enter data operations, analysis, or visualization requests:",
        placeholder=(
            "e.g., Impute missing values with column medians, detect outlier"
            " values, generate an executive summary, and plot a distribution"
            " chart."
        ),
        height=110,
    )
    execute_button = st.button(
        "Run Execution Engine", type="primary", use_container_width=True
    )

  if execute_button and user_instruction:
    # Construct structured schema context without sending entire datasets
    schema_payload = {
        "columns": list(active_df.columns),
        "data_types": {col: str(dtype) for col, dtype in active_df.dtypes.items()},
        "sample_records": active_df.head(2).to_dict(orient="records"),
    }

    system_prompt = f"""
You are INSIGHTiQ, an expert Python data analytics and visualization system.
You are operating on an active pandas DataFrame named `df`.

Dataset Schema & Sample:
{json.dumps(schema_payload)}

User Request: "{user_instruction}"

Execution Guidelines:
1. Return executable Python code wrapped ONLY between ```python and ```.
2. If data cleaning, transformations, or aggregations are requested, modify `df` in-place or reassign `df`.
3. If visualizations are requested, construct a modern Plotly figure and assign it to a variable named `fig` using `px` or `go`. Set `template="plotly_white"`.
4. Provide a structured, professional analytical summary in a string variable named `summary`.
5. Do NOT import files, do NOT call `fig.show()`, and do NOT write commentary outside the code block.
"""

    with st.spinner("INSIGHTiQ is computing and generating code..."):
      raw_response = query_local_llm(system_prompt)

      if "ERROR:" in raw_response:
        st.error(raw_response)
      else:
        # Extract code block using regular expressions
        code_match = re.search(r"```python(.*?)```", raw_response, re.DOTALL)
        clean_code = (
            code_match.group(1).strip() if code_match else raw_response.strip()
        )

        # Isolated execution namespace
        exec_scope = {
            "df": active_df.copy(),
            "pd": pd,
            "px": px,
            "go": go,
            "fig": None,
            "summary": "",
        }

        try:
          exec(clean_code, {}, exec_scope)

          # Update the global session state with the modified dataframe
          st.session_state["active_df"] = exec_scope.get("df", active_df)

          st.write("---")
          st.subheader("Analysis & Outputs")

          # Render Plotly visualization
          if exec_scope.get("fig") is not None:
            st.plotly_chart(exec_scope["fig"], use_container_width=True)

          # Render Analytical Summary
          if exec_scope.get("summary"):
            st.info(exec_scope["summary"])

          # Display Updated Data Preview
          st.subheader("Updated Data View")
          st.dataframe(
              st.session_state["active_df"].head(10), use_container_width=True
          )

        except Exception as runtime_error:
          st.error(f"Code Execution Error: {runtime_error}")
          with st.expander("Inspect Generated Code"):
            st.code(clean_code, language="python")

  # Data Export Sidebar
  st.sidebar.write("---")
  st.sidebar.subheader("Export Center")
  csv_buffer = io.StringIO()
  st.session_state["active_df"].to_csv(csv_buffer, index=False)
  st.sidebar.download_button(
      label="Download Processed CSV",
      data=csv_buffer.getvalue(),
      file_name="INSIGHTiQ_Processed_Data.csv",
      mime="text/csv",
  )

else:
  st.info("Upload a CSV, Excel, or JSON dataset from the sidebar to begin.")