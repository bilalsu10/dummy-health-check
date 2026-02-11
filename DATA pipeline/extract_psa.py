import pandas as pd
import re

from helpers import load_sheet_or_bill, fixed_concat_by_cols, norm_hn, pick_col_contains_any


def _find_col_norm(cols, keys):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if any(k in s for k in norm_keys):
            return c
    return None


def extract_psa(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    df, from_bill = load_sheet_or_bill(path, xls, "มะเร็งต่อมลูกหมาก")
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "รหัสพนักงาน", "SCG", "Employee"],
        )
        if hn_col is None and "col_2" in df.columns:
            hn_col = "col_2"
        if hn_col is None:
            raise ValueError("มะเร็งต่อมลูกหมาก: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["PSA", "สารบ่งชี้มะเร็งต่อมลูกหมาก", "ng/ml"])
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล"])
    if value_col is None or summary_col is None:
        if from_bill:
            out = pd.DataFrame({
                "HN": df["HN"],
                "ExamItem": "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด",
                "Result": "",
            }).merge(people, on="HN", how="left")
            return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
        raise ValueError(f"PSA: Cannot find required columns. Available: {cols}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด",
        "Result": fixed_concat_by_cols(df, [value_col, summary_col]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
