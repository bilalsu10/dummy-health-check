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


def _find_col_norm(cols, keys):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if any(k in s for k in norm_keys):
            return c
    return None


def _empty_result(people: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "HN": people["HN"],
        "ExamItem": "ตรวจกรดยูริคในเลือด",
        "Result": "",
    }).merge(people, on="HN", how="left")
    return out[[
        "HN",
        "SCG_EmpID",
        "Name",
        "DOB",
        "Age",
        "Position",
        "Section",
        "Department",
        "Division",
        "ExamItem",
        "Result",
    ]]


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


def _from_bill(path: str, people: pd.DataFrame) -> pd.DataFrame:
    df = read_bill_table(path)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "SCG EmpID", "SCG_EmpID", "Employee ID", "รหัสพนักงาน", "รหัส"],
        )
        if hn_col is None:
            hn_col = _infer_hn_col(df, people)
        if hn_col is None:
            return _empty_result(people)
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)

    def _is_uric_col(c):
        s = str(c).lower()
        if "hippuric" in s or "methyl hippuric" in s:
            return False
        return "uric" in s or "ยูริค" in s

    uric_cols = [c for c in cols if _is_uric_col(c)]
    if not uric_cols:
        return _empty_result(people)

    # Prefer explicit "URIC" column if present, else first Uric (value) column.
    value_col = None
    for c in uric_cols:
        if str(c).strip().upper() == "URIC":
            value_col = c
            break
    if value_col is None:
        value_col = uric_cols[0]

    # Summary column: try to find column containing "สรุป" and "Uric",
    # or a column next to the value column that contains "สรุป".
    summary_col = None
    for c in cols:
        s = str(c)
        if ("Uric" in s or "uric" in s) and ("สรุป" in s or "Summary" in s or "summary" in s):
            summary_col = c
            break
    if summary_col is None:
        # Sometimes summary header becomes mojibake; detect by Uric + non-ascii.
        for c in cols:
            s = str(c)
            if ("Uric" in s or "uric" in s) and any(ord(ch) > 127 for ch in s):
                summary_col = c
                break
    if summary_col is None:
        try:
            idx = cols.index(value_col)
            if idx + 1 < len(cols):
                candidate = cols[idx + 1]
                if "สรุป" in str(candidate) or "Summary" in str(candidate) or "summary" in str(candidate):
                    summary_col = candidate
        except ValueError:
            summary_col = None
    if summary_col is None:
        return _empty_result(people)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจกรดยูริคในเลือด",
        "Result": fixed_concat_by_cols(df, [value_col, summary_col]),
    }).merge(people, on="HN", how="left")

    return out[[
        "HN",
        "SCG_EmpID",
        "Name",
        "DOB",
        "Age",
        "Position",
        "Section",
        "Department",
        "Division",
        "ExamItem",
        "Result",
    ]]


def extract_uric_acid(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    if "Bill" in xls.sheet_names:
        bill_out = _from_bill(path, people)
        if "Result" in bill_out.columns and bill_out["Result"].astype(str).str.strip().ne("").any():
            return bill_out
    try:
        sheet = resolve_sheet(xls, "กรดยูริคในเลือด")
        df = read_sheet_data_block(path, sheet)
    except ValueError:
        return _empty_result(people)

    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            return _empty_result(people)
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["กรดยูริคในเลือด", "Uric Acid", "uric", "mg/dl"])
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล"])
    if value_col is None:
        return _empty_result(people)
    if summary_col is None:
        try:
            value_idx = cols.index(value_col)
            if value_idx + 1 < len(cols):
                summary_col = cols[value_idx + 1]
        except ValueError:
            summary_col = None
    if summary_col is None:
        return _empty_result(people)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจกรดยูริคในเลือด",
        "Result": fixed_concat_by_cols(df, [value_col, summary_col]),
    }).merge(people, on="HN", how="left")

    return out[[
        "HN",
        "SCG_EmpID",
        "Name",
        "DOB",
        "Age",
        "Position",
        "Section",
        "Department",
        "Division",
        "ExamItem",
        "Result",
    ]]
