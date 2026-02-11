import pandas as pd
import re

from helpers import resolve_sheet, fixed_concat_by_cols, norm_hn, pick_col_contains_any, read_sheet_data_block


def _find_col_norm(cols, keys):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if any(k in s for k in norm_keys):
            return c
    return None


def extract_drug_urine(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "สารเสพติดในปัสสาวะ"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("สารเสพติดในปัสสาวะ: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["ผลการตรวจสารเสพติดในปัสสาวะ", "Amphetamine", "สารเสพติด"])
    if value_col is None:
        # Extra fallback if headers are garbled but still include Amphetamine text.
        for c in cols:
            if "amphetamine" in str(c).lower():
                value_col = c
                break
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล", "Negative"])
    if value_col is None:
        raise ValueError(f"สารเสพติดในปัสสาวะ: Cannot find value column. Available: {cols}")
    if summary_col is None:
        # Fallback: pick the next column to the right of the value column.
        try:
            value_idx = cols.index(value_col)
            if value_idx + 1 < len(cols):
                summary_col = cols[value_idx + 1]
        except ValueError:
            summary_col = None
    if summary_col is None:
        raise ValueError(f"สารเสพติดในปัสสาวะ: Cannot find summary column. Available: {cols}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจสารเสพติดในปัสสาวะ",
        "Result": fixed_concat_by_cols(df, [value_col, summary_col]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
