import pandas as pd
import re

from helpers import (
    resolve_sheet,
    fixed_concat_by_cols,
    norm_hn,
    pick_col_contains_any,
    read_sheet_data_block,
    read_bill_table,
)

TH_LEAD_SHEET = "\u0e2a\u0e32\u0e23\u0e15\u0e30\u0e01\u0e31\u0e48\u0e27\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14Lead"
TH_LEAD_ITEM = "\u0e15\u0e23\u0e27\u0e08\u0e2a\u0e32\u0e23\u0e15\u0e30\u0e01\u0e31\u0e48\u0e27\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14"
TH_NORMAL = "\u0e1b\u0e01\u0e15\u0e34"
TH_ABNORMAL = "\u0e1c\u0e34\u0e14\u0e1b\u0e01\u0e15\u0e34"

def _concat_or_empty(row, cols_in_order):
    values = []
    for c in cols_in_order:
        if c in row:
            v = str(row.get(c, "")).strip()
        else:
            v = ""
        if v.lower() == "nan":
            v = ""
        values.append(v)
    if all(v == "" for v in values):
        return ""
    return ",".join(values)

def _find_col_norm(cols, keys):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if any(k in s for k in norm_keys):
            return c
    return None

def _detect_year_token(path: str) -> str:
    name = path.replace(" ", "")
    for token in ["2568", "2567", "2566", "2565", "68", "67", "66", "65"]:
        if token in name:
            return token[-2:]
    return "unknown"

def _calc_lead_summary(value):
    if value is None:
        return ""
    text = str(value).strip()
    if text == "" or text.lower() == "nan":
        return ""
    try:
        num = float(text)
    except Exception:
        return ""
    if pd.isna(num):
        return ""
    return TH_ABNORMAL if num > 200 else TH_NORMAL

def _infer_hn_col(df: pd.DataFrame, people: pd.DataFrame):
    people_hn = set(people["HN"].dropna().astype(str).map(norm_hn))
    best_col = None
    best_hits = 0
    for col in df.columns:
        series = df[col].dropna().astype(str).map(norm_hn)
        hits = sum(1 for v in series if v in people_hn)
        if hits > best_hits:
            best_hits = hits
            best_col = col
    return best_col if best_hits > 0 else None

def _empty_result(people: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "HN": people["HN"],
        "ExamItem": TH_LEAD_ITEM,
        "Result": "",
    }).merge(people, on="HN", how="left")
    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]

def _from_bill(path: str, people: pd.DataFrame) -> pd.DataFrame:
    df = read_bill_table(path)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "SCG EmpID", "SCG_EmpID", "Employee ID", "\u0e23\u0e2b\u0e31\u0e2a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19", "\u0e23\u0e2b\u0e31\u0e2a"],
        )
        if hn_col is None:
            hn_col = _infer_hn_col(df, people)
        if hn_col is None:
            return _empty_result(people)
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["Lead in Blood", "Lead", "\u0e15\u0e30\u0e01\u0e31\u0e48\u0e27", "ug/L", "ug/dl"])
    if value_col is None:
        return _empty_result(people)

    year = _detect_year_token(path)
    summary_col = None
    if year in ("67", "68"):
        try:
            idx = cols.index(value_col)
            if idx + 1 < len(cols):
                summary_col = cols[idx + 1]
        except ValueError:
            summary_col = None

    if year == "66":
        summary = df[value_col].apply(_calc_lead_summary)
        result = pd.DataFrame({"v": df[value_col], "s": summary}).apply(
            lambda r: _concat_or_empty(r, ["v", "s"]), axis=1
        )
    else:
        if summary_col is None:
            summary = df[value_col].apply(_calc_lead_summary)
            result = pd.DataFrame({"v": df[value_col], "s": summary}).apply(
                lambda r: _concat_or_empty(r, ["v", "s"]), axis=1
            )
        else:
            result = df.apply(lambda r: _concat_or_empty(r, [value_col, summary_col]), axis=1)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_LEAD_ITEM,
        "Result": result,
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]

def extract_lead_blood(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    if "Bill" in xls.sheet_names:
        bill_out = _from_bill(path, people)
        if bill_out["Result"].astype(str).str.strip().ne("").any():
            return bill_out

    sheet = resolve_sheet(xls, TH_LEAD_SHEET)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."]) 
        if hn_col is None:
            raise ValueError("\u0e2a\u0e32\u0e23\u0e15\u0e30\u0e01\u0e31\u0e48\u0e27\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["\u0e2a\u0e32\u0e23\u0e15\u0e30\u0e01\u0e31\u0e48\u0e27\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14", "Lead", "ug/dl", "ug/L"])
    summary_col = _find_col_norm(cols, ["\u0e2a\u0e23\u0e38\u0e1b\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08", "\u0e2a\u0e23\u0e38\u0e1b\u0e1c\u0e25"])
    if value_col is None:
        raise ValueError(f"Lead: Cannot find required columns. Available: {cols}")

    year = _detect_year_token(path)
    if summary_col is None:
        if year == "66":
            summary = df[value_col].apply(_calc_lead_summary)
            result = pd.DataFrame({"v": df[value_col], "s": summary}).apply(
                lambda r: _concat_or_empty(r, ["v", "s"]), axis=1
            )
        else:
            result = df.apply(lambda r: _concat_or_empty(r, [value_col]), axis=1)
    else:
        if year == "66":
            summary = df[value_col].apply(_calc_lead_summary)
            result = pd.DataFrame({"v": df[value_col], "s": summary}).apply(
                lambda r: _concat_or_empty(r, ["v", "s"]), axis=1
            )
        else:
            result = df.apply(lambda r: _concat_or_empty(r, [value_col, summary_col]), axis=1)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_LEAD_ITEM,
        "Result": result,
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
