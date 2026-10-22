"""
InsightIQ Core Python/Pandas Analytics Engine
Performs deterministic filtering, grouping, sorting, aggregation, numerical calculations,
chart data preparation, and plain-English answer generation.
"""

import json
import re
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np


def humanize_name(col: str) -> str:
    """Converts machine/raw column names into human readable Title Case without underscores."""
    if not col:
        return ""
    col_str = str(col).strip()
    replacements = [
        (r"\bprice_per_lb\b", "Price per Pound"),
        (r"\bprice_per_pound\b", "Price per Pound"),
        (r"\bquantity_lbs\b", "Pounds in Stock"),
        (r"\bquantity_in_stock\b", "Quantity in Stock"),
        (r"\bin_stock\b", "Available in Stock"),
        (r"\border_date\b", "Order Date"),
        (r"\border_id\b", "Order ID"),
        (r"\btotal_amount\b", "Total Amount"),
        (r"\bmrr\b", "MRR"),
        (r"\barr\b", "ARR"),
        (r"\bcsat\b", "CSAT"),
        (r"\bsku\b", "SKU"),
        (r"\bid\b", "ID"),
    ]
    for pattern, rep in replacements:
        if re.search(pattern, col_str, re.I):
            return rep

    words = re.sub(r"[_\-]+", " ", col_str).split()
    return " ".join(w.capitalize() for w in words)


def format_number(val: float, col_name: str = "") -> str:
    """Formats numeric values with friendly business notation ($1.2M, $45.2K, etc.)."""
    if pd.isna(val) or val is None:
        return "0"

    is_currency = bool(
        re.search(
            r"revenue|price|cost|sales|profit|amount|spend|arr|mrr|budget|margin|\$|value|worth",
            col_name,
            re.I,
        )
    )
    is_percent = bool(re.search(r"percent|pct|rate|ratio", col_name, re.I))
    prefix = "$" if is_currency else ""
    suffix = "%" if is_percent else ""

    abs_v = abs(val)
    if abs_v >= 1_000_000_000:
        return f"{prefix}{val / 1_000_000_000:.1f}B{suffix}"
    if abs_v >= 1_000_000:
        return f"{prefix}{val / 1_000_000:.1f}M{suffix}"
    if abs_v >= 10_000:
        return f"{prefix}{val / 1_000:.1f}K{suffix}"
    if abs_v >= 1_000:
        return f"{prefix}{val:,.0f}{suffix}"
    if float(val).is_integer():
        return f"{prefix}{int(val):,}{suffix}"
    return f"{prefix}{val:,.2f}{suffix}"


def analyze_dataframe_structure(df: pd.DataFrame) -> Dict[str, Any]:
    """Inspects DataFrame columns and identifies candidate metrics, dimensions, and dates."""
    columns = list(df.columns)

    # 1. Identify Numeric Columns
    numeric_cols = []
    for col in columns:
        if pd.api.types.is_numeric_dtype(df[col]):
            if not re.search(r"id|code|key|uuid|zip|phone|ssn|pin|sku", col, re.I):
                numeric_cols.append(col)
        else:
            sample = df[col].dropna().astype(str).head(100)
            cleaned = sample.str.replace(r"[\$,€,£,¥,\s,%]", "", regex=True)
            num_converted = pd.to_numeric(cleaned, errors="coerce")
            if num_converted.notna().mean() > 0.8 and not re.search(r"id|code|key|zip", col, re.I):
                numeric_cols.append(col)

    # 2. Identify Date Columns
    date_cols = []
    for col in columns:
        if pd.api.types.is_datetime64_any_dtype(df[col]):
            date_cols.append(col)
        elif re.search(r"date|time|timestamp|created|updated|day|month|year|period", col, re.I):
            sample = df[col].dropna().astype(str).head(50)
            try:
                parsed = pd.to_datetime(sample, errors="coerce")
                if parsed.notna().mean() > 0.5:
                    date_cols.append(col)
            except Exception:
                pass

    # 3. Identify Categorical Columns
    cat_cols = []
    for col in columns:
        if col not in numeric_cols and col not in date_cols:
            unique_cnt = df[col].nunique(dropna=True)
            if 1 < unique_cnt <= 200 and not re.search(r"id|uuid|hash|url|avatar", col, re.I):
                cat_cols.append(col)

    # Price, quantity, revenue detection
    price_col = None
    qty_col = None
    rev_col = None
    for c in numeric_cols:
        if re.search(r"price|cost|rate", c, re.I) and not price_col:
            price_col = c
        elif re.search(r"quantity|units|stock|qty|volume|lbs|pounds", c, re.I) and not qty_col:
            qty_col = c
        elif re.search(r"revenue|sales|total|amount|mrr|arr", c, re.I) and not rev_col:
            rev_col = c

    primary_metric = rev_col or qty_col or price_col or (numeric_cols[0] if numeric_cols else None)

    # Best Primary Category: Prioritize Fruit / Product / Item / Category / Name
    primary_category = None
    cat_priority = re.compile(r"fruit|product|item|name|category|segment|region|channel|status|department|plan|type", re.I)
    for c in cat_cols:
        if cat_priority.search(c):
            primary_category = c
            break
    if not primary_category and cat_cols:
        primary_category = cat_cols[0]

    primary_date = date_cols[0] if date_cols else None

    # Identify flag columns (Yes/No, True/False, in_stock)
    flag_cols = []
    for col in columns:
        if col in cat_cols or col not in numeric_cols:
            vals = set(df[col].dropna().astype(str).str.lower().unique())
            if vals.issubset({"yes", "no", "true", "false", "y", "n", "1", "0", "available", "unavailable"}):
                flag_cols.append(col)

    return {
        "columns": columns,
        "numeric_cols": numeric_cols,
        "date_cols": date_cols,
        "cat_cols": cat_cols,
        "flag_cols": flag_cols,
        "price_col": price_col,
        "qty_col": qty_col,
        "rev_col": rev_col,
        "primary_metric": primary_metric,
        "primary_category": primary_category,
        "primary_date": primary_date,
    }


def generate_dataset_questions(df: pd.DataFrame) -> List[str]:
    """
    Generates a small list of highly relevant business questions based ONLY on the uploaded dataset.
    Uses human-friendly Title Case labels without machine underscores.
    """
    structure = analyze_dataframe_structure(df)
    m = structure["primary_metric"]
    c = structure["primary_category"]
    d = structure["primary_date"]
    price_c = structure["price_col"]
    qty_c = structure["qty_col"]

    questions = []

    def plural(word: str) -> str:
        w_lower = word.lower()
        if w_lower.endswith("y") and not w_lower.endswith(("ay", "ey")):
            return word[:-1] + "ies"
        if w_lower.endswith(("s", "sh", "ch")):
            return word + "es"
        return word + "s"

    c_human = humanize_name(c).lower() if c else "item"
    m_human = humanize_name(m).lower() if m else "volume"

    if c:
        questions.append(f"List all {plural(c_human)} in the dataset")

    if price_c and c:
        p_human = humanize_name(price_c).lower()
        questions.append(f"Which {c_human} is the most expensive?")
        questions.append(f"Which {c_human} is the cheapest?")
        questions.append(f"What is the average {p_human} across all {plural(c_human)}?")

    if qty_c and c:
        q_human = humanize_name(qty_c).lower()
        questions.append(f"Which {c_human} has the highest {q_human}?")

    if price_c and qty_c and c:
        questions.append(f"Which {c_human} holds the highest inventory value?")

    if m and c and m != price_c and m != qty_c:
        questions.append(f"Which {c_human} generated the most {m_human}?")
        questions.append(f"What is the total {m_human} by {c_human}?")

    if d and m:
        date_series = pd.to_datetime(df[d], errors="coerce").dropna()
        if not date_series.empty:
            years = date_series.dt.year.unique()
            if len(years) > 1:
                questions.append(f"Which year had the highest {m_human}?")
            questions.append(f"Which month performed best for {m_human}?")
            questions.append(f"How did {m_human} change over time?")

    # Check for second category
    other_cats = [col for col in structure["cat_cols"] if col != c and col not in structure["flag_cols"]]
    if other_cats:
        sec = other_cats[0]
        sec_human = humanize_name(sec).lower()
        questions.append(f"Breakdown of {plural(c_human)} by {sec_human}")

    # Out of stock check
    if structure["flag_cols"] or (qty_c and (df[qty_c] <= 0).any()):
        questions.append(f"Which {plural(c_human)} are currently out of stock?")

    # Deduplicate and return top 6
    seen = set()
    result = []
    for q in questions:
        q_clean = q.strip()
        if q_clean.lower() not in seen:
            seen.add(q_clean.lower())
            result.append(q_clean)
            if len(result) >= 6:
                break

    return result


def check_relevance(
    q_lower: str, columns: List[str], df: pd.DataFrame
) -> Tuple[bool, Optional[str], Optional[str]]:
    """
    Checks whether the query is actually relevant to this dataset:
    1. Direct match with column names or column word tokens (e.g. 'fruit' in 'Fruit', 'stock' in 'In_Stock').
    2. Direct match with categorical values (e.g. 'red', 'strawberry', 'web').
    3. Direct match with business domain metrics (e.g. 'revenue' if revenue exists).
    Returns (is_relevant, matched_col, matched_val).
    """
    col_words = {}
    for c in columns:
        parts = [p.lower() for p in re.split(r"[_\s\-]+", c)]
        col_words[c] = parts

    q_words = re.findall(r"\b[a-zA-Z]{3,}\b", q_lower)
    stem_map = {
        "fruits": "fruit",
        "colors": "color",
        "prices": "price",
        "quantities": "quantity",
        "stocks": "stock",
        "items": "item",
        "names": "name",
        "orders": "order",
        "sales": "sales",
        "revenues": "revenue",
    }
    q_stems = [stem_map.get(w, w.rstrip("s")) for w in q_words]

    matched_col = None
    for c, words in col_words.items():
        c_stems = [stem_map.get(w, w.rstrip("s")) for w in words]
        for qw, qs in zip(q_words, q_stems):
            if qw in words or qs in c_stems or any(qw in cw for cw in words):
                matched_col = c
                break
        if matched_col:
            break

    # Check common domain terms
    if not matched_col:
        if re.search(r"expensive|cheap|cost", q_lower) and any(re.search(r"price|cost", c, re.I) for c in columns):
            matched_col = [c for c in columns if re.search(r"price|cost", c, re.I)][0]
        elif re.search(r"stock|available|inventory|lbs|pounds|units", q_lower) and any(re.search(r"stock|qty|quantity|units", c, re.I) for c in columns):
            matched_col = [c for c in columns if re.search(r"stock|qty|quantity|units", c, re.I)][0]
        elif re.search(r"worth|inventory value", q_lower) and any(re.search(r"price", c, re.I) for c in columns) and any(re.search(r"qty|quantity", c, re.I) for c in columns):
            matched_col = [c for c in columns if re.search(r"fruit|product|item", c, re.I)][0]
        elif re.search(r"revenue|sales|total amount", q_lower) and any(re.search(r"revenue|sales|amount|total", c, re.I) for c in columns):
            matched_col = [c for c in columns if re.search(r"revenue|sales|amount|total", c, re.I)][0]

    matched_val_col = None
    matched_val = None
    for c in columns:
        if df[c].dtype == object or df[c].nunique() < 100:
            for val in df[c].dropna().astype(str).unique()[:50]:
                if len(val) >= 2 and re.search(rf"\b{re.escape(val.lower())}\b", q_lower):
                    matched_val_col = c
                    matched_val = val
                    break
        if matched_val:
            break

    return bool(matched_col or matched_val), matched_col, matched_val


def execute_pandas_query(df: pd.DataFrame, question: str) -> Dict[str, Any]:
    """
    Answers a plain-English question by performing actual Pandas calculations:
    1. Understands question intent (list, ranking, filter, scalar, category breakdown, trend).
    2. Identifies required columns and calculations.
    3. Decides the most useful chart type with explicit reasoning.
    4. Executes Pandas calculations deterministically.
    5. Formats human-readable answer and chart data with Title Case labels.
    """
    q_lower = question.lower().strip()
    structure = analyze_dataframe_structure(df)

    columns = structure["columns"]
    num_cols = structure["numeric_cols"]
    cat_cols = structure["cat_cols"]
    date_cols = structure["date_cols"]
    flag_cols = structure["flag_cols"]
    primary_cat = structure["primary_category"]
    primary_metric = structure["primary_metric"]
    primary_date = structure["primary_date"]
    price_col = structure["price_col"]
    qty_col = structure["qty_col"]
    rev_col = structure["rev_col"]

    # 1. Relevance / Alien Check
    is_rel, matched_col, matched_val = check_relevance(q_lower, columns, df)

    is_general_query = any(
        k in q_lower
        for k in [
            "summary of data",
            "overview of dataset",
            "all data",
            "show dataset",
            "data preview",
            "table preview",
            "show records",
            "what is this data about",
            "what is in this file",
        ]
    )

    if not is_rel and not is_general_query:
        human_cols = [humanize_name(c) for c in columns]
        return {
            "can_answer": False,
            "question": question,
            "headline": "Cannot answer from this dataset",
            "explanation": f"This question cannot be answered from the uploaded dataset. The file contains columns: [{', '.join(human_cols)}], but has no records or fields related to your query.",
            "calculation_details": "No matching columns or values found in the active dataset.",
            "chart_type": "none",
            "chart_config": None,
            "data": [],
        }

    # =========================================================================
    # INTENT 1: OUT OF STOCK / IN STOCK / AVAILABILITY FILTER
    # =========================================================================
    is_out_of_stock = bool(re.search(r"out of stock|zero stock|unavailable|missing stock|no stock", q_lower))
    is_in_stock = bool(re.search(r"in stock|available|have stock|positive stock", q_lower))

    if (is_out_of_stock or is_in_stock) and (flag_cols or qty_col or "In_Stock" in columns):
        target_flag = flag_cols[0] if flag_cols else ("In_Stock" if "In_Stock" in columns else None)

        if is_out_of_stock:
            if target_flag:
                filtered = df[df[target_flag].astype(str).str.lower().isin(["no", "false", "0", "n", "out of stock"])]
            elif qty_col:
                filtered = df[df[qty_col] <= 0]
            else:
                filtered = pd.DataFrame()

            display_cat = primary_cat or columns[0]
            items = filtered[display_cat].astype(str).tolist() if not filtered.empty else []

            if items:
                items_str = ", ".join(items[:5])
                headline = f"{items_str} {'is' if len(items) == 1 else 'are'} currently out of stock."
                explanation = f"Found {len(items)} out-of-stock item(s) out of {len(df)} total entries in the catalog."
            else:
                headline = "All items are currently in stock with positive inventory."
                explanation = f"None of the {len(df)} entries have zero stock or an out-of-stock flag."

            chart_data = []
            if not filtered.empty and qty_col:
                for _, r in filtered.head(10).iterrows():
                    chart_data.append({
                        display_cat: str(r[display_cat]),
                        "Quantity": float(r[qty_col]) if pd.notna(r[qty_col]) else 0,
                        "FormattedValue": "0 units (Out of stock)",
                    })
            else:
                chart_data = df[[display_cat, target_flag or qty_col]].head(10).to_dict(orient="records")

            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": explanation,
                "calculation_details": f"Python/Pandas: df[df['{target_flag or qty_col}'] == 'No']",
                "chart_type": "table" if len(chart_data) > 0 else "metric",
                "chart_config": {
                    "title": "Out of Stock Items",
                    "xAxisLabel": humanize_name(display_cat),
                    "yAxisLabel": "Availability Status",
                    "reasoning": "Tabular listing immediately highlights which catalog items cannot fulfill customer orders.",
                },
                "data": chart_data,
                "xKey": display_cat,
                "yKey": "Quantity" if qty_col in df.columns else target_flag,
            }

    # =========================================================================
    # INTENT 2: VALUE / WORTH (Price × Quantity = Inventory Value or Revenue)
    # =========================================================================
    is_value_q = bool(re.search(r"worth|inventory value|total value|total revenue|how much is.*worth", q_lower))
    if is_value_q and price_col and qty_col and primary_cat:
        calc_df = df.copy()
        calc_df["_computed_value"] = pd.to_numeric(calc_df[price_col], errors="coerce").fillna(0) * pd.to_numeric(calc_df[qty_col], errors="coerce").fillna(0)
        grouped = calc_df.groupby(primary_cat)["_computed_value"].sum().reset_index()
        grouped.columns = [primary_cat, "Value"]
        grouped = grouped.sort_values(by="Value", ascending=False)
        total_val = grouped["Value"].sum()

        chart_data = grouped.head(10).to_dict(orient="records")
        for item in chart_data:
            item["FormattedValue"] = format_number(item["Value"], "price")

        top_item = chart_data[0]
        headline = f'"{top_item[primary_cat]}" represents your highest inventory value at {format_number(top_item["Value"], "price")}.'
        explanation = f"Calculated by multiplying {humanize_name(price_col)} by {humanize_name(qty_col)}. Total inventory value across all items is {format_number(total_val, 'price')}."

        return {
            "can_answer": True,
            "question": question,
            "headline": headline,
            "explanation": explanation,
            "calculation_details": f"Python/Pandas: df['{price_col}'] * df['{qty_col}'] by '{primary_cat}'",
            "chart_type": "bar",
            "chart_config": {
                "title": f"Inventory Value by {humanize_name(primary_cat)}",
                "xAxisLabel": humanize_name(primary_cat),
                "yAxisLabel": "Total Inventory Value ($)",
                "reasoning": "A bar chart sorted largest to smallest shows which items tie up the most capital.",
            },
            "data": chart_data,
            "xKey": primary_cat,
            "yKey": "Value",
        }

    # =========================================================================
    # INTENT 3: SCALAR AVERAGE / TOTAL / STATS (Handle before rankings)
    # =========================================================================
    is_avg_query = bool(re.search(r"average|mean|avg|typical|per entry|per record", q_lower))
    is_total_scalar = bool(re.search(r"overall total|grand total|sum of", q_lower))

    if (is_avg_query or is_total_scalar) and not re.search(r"by|across|breakdown", q_lower):
        target_scalar_metric = None
        if re.search(r"price|expensive|cheap|cost|rate", q_lower) and price_col:
            target_scalar_metric = price_col
        elif re.search(r"quantity|stock|inventory|lbs|pounds|units|volume", q_lower) and qty_col:
            target_scalar_metric = qty_col
        elif re.search(r"revenue|sales|amount|worth|value", q_lower) and rev_col:
            target_scalar_metric = rev_col
        else:
            target_scalar_metric = matched_col if (matched_col in num_cols) else primary_metric

        if target_scalar_metric:
            series = pd.to_numeric(df[target_scalar_metric], errors="coerce").dropna()
            if not series.empty:
                is_price = bool(re.search(r"price|rate|cost", target_scalar_metric, re.I))

                if is_price and not is_avg_query and re.search(r"total|sum", q_lower):
                    avg_val = series.mean()
                    headline = f"Prices represent rates per unit, so average ({format_number(avg_val, target_scalar_metric)}) is the meaningful metric."
                    explanation = f"Summing unit prices is not mathematically meaningful. The average price is {format_number(avg_val, target_scalar_metric)}."
                    val_to_report = avg_val
                    op_name = "Average"
                elif is_avg_query:
                    val_to_report = series.mean()
                    op_name = "Average"
                    headline = f"The average {humanize_name(target_scalar_metric).lower()} is {format_number(val_to_report, target_scalar_metric)}."
                    explanation = f"Calculated across {len(series)} entries, ranging from {format_number(series.min(), target_scalar_metric)} to {format_number(series.max(), target_scalar_metric)}."
                else:
                    val_to_report = series.sum()
                    op_name = "Total"
                    headline = f"The overall total {humanize_name(target_scalar_metric).lower()} is {format_number(val_to_report, target_scalar_metric)}."
                    explanation = f"Combined sum across all {len(series)} entries."

                metric_data = [
                    {
                        "Metric": f"Calculated {op_name}",
                        "Value": round(val_to_report, 2),
                        "FormattedValue": format_number(val_to_report, target_scalar_metric),
                    },
                    {
                        "Metric": "Middle (Median)",
                        "Value": round(series.median(), 2),
                        "FormattedValue": format_number(series.median(), target_scalar_metric),
                    },
                    {
                        "Metric": "Peak (Maximum)",
                        "Value": round(series.max(), 2),
                        "FormattedValue": format_number(series.max(), target_scalar_metric),
                    },
                ]

                return {
                    "can_answer": True,
                    "question": question,
                    "headline": headline,
                    "explanation": explanation,
                    "calculation_details": f"Python/Pandas: df['{target_scalar_metric}'].{op_name.lower()}()",
                    "chart_type": "metric",
                    "chart_config": {
                        "title": f"Overall {op_name} {humanize_name(target_scalar_metric)}",
                        "xAxisLabel": "Metric",
                        "yAxisLabel": humanize_name(target_scalar_metric),
                        "reasoning": "A prominent metric card presents the calculated figure cleanly without chart clutter.",
                    },
                    "data": metric_data,
                    "xKey": "Metric",
                    "yKey": "Value",
                }

    # =========================================================================
    # INTENT 4: SPECIFIC VALUE FILTER (e.g. "red fruits", "how many red")
    # =========================================================================
    if matched_val and matched_val_col and not re.search(r"which|highest|lowest|cheapest|expensive", q_lower):
        filtered = df[df[matched_val_col].astype(str).str.lower() == matched_val.lower()]
        display_col = primary_cat if (primary_cat and primary_cat != matched_val_col) else matched_val_col
        names = filtered[display_col].astype(str).tolist()
        names_str = ", ".join(names[:5])

        headline = f'Found {len(filtered)} items where {humanize_name(matched_val_col)} is "{matched_val}": {names_str}.'
        metric_show = price_col or qty_col or primary_metric
        chart_data = []
        if metric_show:
            for _, r in filtered.head(10).iterrows():
                val = float(r[metric_show]) if pd.notna(r[metric_show]) else 0
                chart_data.append({
                    display_col: str(r[display_col]),
                    "Value": val,
                    "FormattedValue": format_number(val, metric_show),
                })

        return {
            "can_answer": True,
            "question": question,
            "headline": headline,
            "explanation": f"Filtered records where {humanize_name(matched_val_col)} equals '{matched_val}'.",
            "calculation_details": f"Python/Pandas: df[df['{matched_val_col}'] == '{matched_val}']",
            "chart_type": "bar" if len(chart_data) > 1 else "metric",
            "chart_config": {
                "title": f"Items with {humanize_name(matched_val_col)}: {matched_val}",
                "xAxisLabel": humanize_name(display_col),
                "yAxisLabel": humanize_name(metric_show or "Count"),
                "reasoning": "Visualizes the filtered subset directly.",
            },
            "data": chart_data,
            "xKey": display_col,
            "yKey": "Value",
        }

    # =========================================================================
    # INTENT 5: BREAKDOWN BY SECOND CATEGORY (e.g. "fruits by color", "breakdown by color")
    # =========================================================================
    second_cat = None
    for c in cat_cols:
        if c != primary_cat and (c.lower() in q_lower or f"{c.lower()}s" in q_lower or f"by {c.lower()}" in q_lower):
            second_cat = c
            break

    if second_cat and re.search(r"by|across|breakdown|per", q_lower):
        metric_col = target_metric = None
        if re.search(r"price|cost", q_lower) and price_col:
            metric_col = price_col
        elif re.search(r"quantity|stock|lbs|pounds|units", q_lower) and qty_col:
            metric_col = qty_col
        elif re.search(r"revenue|sales", q_lower) and rev_col:
            metric_col = rev_col
        else:
            metric_col = qty_col or price_col or primary_metric

        if metric_col:
            agg_f = "mean" if "price" in metric_col.lower() else "sum"
            grouped = df.groupby(second_cat)[metric_col].agg(agg_f).reset_index()
            grouped.columns = [second_cat, "Value"]
            grouped = grouped.sort_values(by="Value", ascending=False)
            chart_data = grouped.to_dict(orient="records")
            for item in chart_data:
                item["FormattedValue"] = format_number(item["Value"], metric_col)

            top = chart_data[0]
            headline = f'"{top[second_cat]}" leads {humanize_name(second_cat)} with {format_number(top["Value"], metric_col)}.'
            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": f"Grouped by {humanize_name(second_cat)} across {len(grouped)} groups.",
                "calculation_details": f"Python/Pandas: df.groupby('{second_cat}')['{metric_col}'].{agg_f}()",
                "chart_type": "bar",
                "chart_config": {
                    "title": f"{humanize_name(metric_col)} by {humanize_name(second_cat)}",
                    "xAxisLabel": humanize_name(second_cat),
                    "yAxisLabel": humanize_name(metric_col),
                    "reasoning": "A bar chart gives a clear comparative breakdown across categories.",
                },
                "data": chart_data,
                "xKey": second_cat,
                "yKey": "Value",
            }

    # =========================================================================
    # INTENT 6: COUNT / HOW MANY ITEMS
    # =========================================================================
    is_count_query = bool(re.search(r"how many|count of|number of|total entries|total records", q_lower))
    if is_count_query:
        target_count_col = matched_col or primary_cat
        if target_count_col and target_count_col in cat_cols:
            cnt = df[target_count_col].nunique()
            headline = f"There are {cnt} distinct {humanize_name(target_count_col).lower()} items in this dataset."
            explanation = f"Calculated across {len(df):,} total rows."

            grouped = df[target_count_col].value_counts().reset_index()
            grouped.columns = [target_count_col, "Count"]
            chart_data = grouped.head(10).to_dict(orient="records")
            for item in chart_data:
                item["FormattedValue"] = str(item["Count"])

            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": explanation,
                "calculation_details": f"Python/Pandas: df['{target_count_col}'].nunique()",
                "chart_type": "metric",
                "chart_config": {
                    "title": f"Total {humanize_name(target_count_col)} Count",
                    "xAxisLabel": humanize_name(target_count_col),
                    "yAxisLabel": "Count",
                    "reasoning": "A metric card provides an immediate direct answer to count questions.",
                },
                "data": [{"Metric": f"Distinct {humanize_name(target_count_col)}", "Value": cnt}],
                "xKey": "Metric",
                "yKey": "Value",
            }

    # =========================================================================
    # INTENT 7: LIST / SHOW ALL / NAMES OF A CATEGORY OR ITEMS
    # =========================================================================
    is_list_query = (
        bool(re.search(r"\blist\b|\bshow\b|\bnames?\b|\ball\b|what.*are there|what.*do we have|which.*do we have|catalog|items", q_lower))
        or q_lower in [c.lower() for c in columns]
        or q_lower in [f"{c.lower()}s" for c in columns]
    ) and not re.search(r"highest|lowest|most|least|best|worst|cheapest|expensive|trend|over time", q_lower)

    target_list_col = matched_col if (matched_col and matched_col in cat_cols) else primary_cat

    if is_list_query and target_list_col:
        unique_items = df[target_list_col].dropna().astype(str).unique().tolist()
        num_items = len(unique_items)
        sample_names = ", ".join(unique_items[:6])
        if num_items > 6:
            sample_names += f", and {num_items - 6} more"

        headline = f"There are {num_items} {humanize_name(target_list_col).lower()} items: {sample_names}."
        explanation = f"Showing all {num_items} recorded {humanize_name(target_list_col).lower()} entries in the dataset."

        metric_for_chart = price_col or qty_col or primary_metric
        if metric_for_chart:
            grouped = df.groupby(target_list_col)[metric_for_chart].mean().reset_index()
            grouped.columns = [target_list_col, "Value"]
            grouped = grouped.sort_values(by="Value", ascending=False)
            chart_data = grouped.head(15).to_dict(orient="records")
            for item in chart_data:
                item["FormattedValue"] = format_number(item["Value"], metric_for_chart)

            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": explanation,
                "calculation_details": f"Python/Pandas: df['{target_list_col}'].unique()",
                "chart_type": "horizontal-bar" if len(chart_data) > 6 else "bar",
                "chart_config": {
                    "title": f"All {humanize_name(target_list_col)} Items",
                    "xAxisLabel": humanize_name(target_list_col),
                    "yAxisLabel": humanize_name(metric_for_chart),
                    "reasoning": "A sorted bar chart lets the owner see all items and their values at a single glance.",
                },
                "data": chart_data,
                "xKey": target_list_col,
                "yKey": "Value",
            }
        else:
            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": explanation,
                "calculation_details": f"Python/Pandas: df['{target_list_col}'].unique()",
                "chart_type": "table",
                "chart_config": {
                    "title": f"Complete List of {humanize_name(target_list_col)}",
                    "xAxisLabel": humanize_name(target_list_col),
                    "yAxisLabel": "Entries",
                    "reasoning": "Tabular layout displays all items clearly.",
                },
                "data": df[[target_list_col]].drop_duplicates().head(15).to_dict(orient="records"),
                "xKey": target_list_col,
                "yKey": target_list_col,
            }

    # =========================================================================
    # INTENT 8: RANKING / BEST / WORST / CHEAPEST / EXPENSIVE / HIGHEST / LOWEST
    # =========================================================================
    is_lowest = bool(re.search(r"cheapest|cheap|least|lowest|bottom|worst|minimum|min|smallest|cheaper", q_lower))
    is_highest = bool(re.search(r"expensive|costliest|highest|most|top|best|maximum|max|largest|biggest|peak|leader", q_lower))

    # Metric selection:
    target_metric = None
    if re.search(r"price|expensive|cheap|cost|rate", q_lower) and price_col:
        target_metric = price_col
    elif re.search(r"quantity|stock|inventory|lbs|pounds|units|volume", q_lower) and qty_col:
        target_metric = qty_col
    elif re.search(r"revenue|sales|amount|worth|value", q_lower) and rev_col:
        target_metric = rev_col
    else:
        target_metric = matched_col if (matched_col in num_cols) else primary_metric

    target_group = matched_col if (matched_col in cat_cols) else primary_cat

    if target_group and target_metric:
        agg_func = "mean" if (is_avg_query or "price" in target_metric.lower()) else "sum"
        grouped = df.groupby(target_group)[target_metric].agg(agg_func).reset_index()
        grouped.columns = [target_group, "Value"]
        grouped = grouped.sort_values(by="Value", ascending=is_lowest)

        limit_match = re.search(r"(?:top|bottom|first|best|worst)\s*(\d+)", q_lower)
        limit = int(limit_match.group(1)) if limit_match else (10 if len(grouped) > 10 else len(grouped))
        sliced = grouped.head(limit)

        chart_data = sliced.to_dict(orient="records")
        for item in chart_data:
            item["FormattedValue"] = format_number(item["Value"], target_metric)

        winner = chart_data[0]
        winner_name = winner[target_group]
        winner_val = format_number(winner["Value"], target_metric)

        metric_label = humanize_name(target_metric)
        group_label = humanize_name(target_group)

        if is_lowest:
            headline = f'"{winner_name}" is the lowest at {winner_val} {metric_label.lower()}.'
        elif is_highest:
            headline = f'"{winner_name}" leads with the highest {metric_label.lower()} at {winner_val}.'
        else:
            headline = f'"{winner_name}" ranks #1 with {winner_val} in {metric_label.lower()}.'

        explanation = f"Sorted across all {len(grouped)} {group_label.lower()} categories."
        if len(chart_data) > 1:
            runner_up = chart_data[1]
            diff = abs(winner["Value"] - runner_up["Value"])
            explanation += f' Outperforms runner-up "{runner_up[target_group]}" by {format_number(diff, target_metric)}.'

        return {
            "can_answer": True,
            "question": question,
            "headline": headline,
            "explanation": explanation,
            "calculation_details": f"Python/Pandas: df.groupby('{target_group}')['{target_metric}'].{agg_func}().sort_values(ascending={is_lowest})",
            "chart_type": "horizontal-bar" if len(chart_data) > 6 else "bar",
            "chart_config": {
                "title": f"{metric_label} by {group_label}",
                "xAxisLabel": group_label,
                "yAxisLabel": metric_label,
                "reasoning": "A sorted bar chart highlights the winning category clearly with exact values on top.",
            },
            "data": chart_data,
            "xKey": target_group,
            "yKey": "Value",
        }

    # =========================================================================
    # INTENT 9: TIME TREND / MONTH / YEAR
    # =========================================================================
    if primary_date and (re.search(r"trend|over time|month|year|date", q_lower)):
        df["_temp_date"] = pd.to_datetime(df[primary_date], errors="coerce")
        df["Period"] = df["_temp_date"].dt.strftime("%Y-%m")
        valid_df = df.dropna(subset=["Period"])
        if not valid_df.empty:
            m_col = target_metric or primary_metric or primary_date
            grouped = valid_df.groupby("Period")[m_col].sum().reset_index()
            grouped.columns = ["Period", "Value"]
            grouped = grouped.sort_values(by="Period")
            chart_data = grouped.to_dict(orient="records")
            for item in chart_data:
                item["FormattedValue"] = format_number(item["Value"], m_col)

            peak = grouped.sort_values(by="Value", ascending=False).iloc[0]
            headline = f"Peak occurred in {peak['Period']} with {format_number(peak['Value'], m_col)}."
            return {
                "can_answer": True,
                "question": question,
                "headline": headline,
                "explanation": f"Tracked monthly over {len(grouped)} months.",
                "calculation_details": f"Python/Pandas: df.groupby(df['{primary_date}'].dt.to_period('M'))['{m_col}'].sum()",
                "chart_type": "area",
                "chart_config": {
                    "title": f"Monthly {humanize_name(m_col)} Trend",
                    "xAxisLabel": "Month",
                    "yAxisLabel": humanize_name(m_col),
                    "reasoning": "An area chart displays the timeline trajectory smoothly.",
                },
                "data": chart_data,
                "xKey": "Period",
                "yKey": "Value",
            }

    # =========================================================================
    # DEFAULT FALLBACK: Preview of Data
    # =========================================================================
    human_cols = [humanize_name(c) for c in columns]
    return {
        "can_answer": True,
        "question": question,
        "headline": f"Dataset contains {len(df):,} total records.",
        "explanation": f"Columns available: {', '.join(human_cols)}. Try asking for specific rankings, totals, or breakdowns.",
        "calculation_details": "Python/Pandas: df.head(8)",
        "chart_type": "table",
        "chart_config": {
            "title": "Dataset Preview",
            "xAxisLabel": "Columns",
            "yAxisLabel": "Rows",
            "reasoning": "Tabular preview of records.",
        },
        "data": df.head(8).to_dict(orient="records"),
    }
