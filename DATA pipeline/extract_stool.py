import pandas as pd
import re

from helpers import (
    load_sheet_or_bill,
    cell_to_str,
    clean_headers,
    find_header_row,
    norm_hn,
    pick_col_contains_any,
)


def extract_stool(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet_name = next(
        (s for s in xls.sheet_names if "Stool" in s or "อุจจาระ" in s),
        None,
    )
    if sheet_name:
        grid = pd.read_excel(path, sheet_name=sheet_name, header=None)
        header_idx = find_header_row(grid)
        headers = clean_headers(grid.iloc[header_idx].tolist())
        df = grid.iloc[header_idx + 1 :].copy()
        df.columns = headers
        df = df.dropna(how="all").reset_index(drop=True)
        from_bill = False
    else:
        df, from_bill = load_sheet_or_bill(path, xls, "อุจจาระStool Exam")

    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "รหัสพนักงาน", "SCG", "Employee"],
        )
        if hn_col is None and "col_2" in df.columns:
            hn_col = "col_2"
        if hn_col is None:
            raise ValueError("อุจจาระStool Exam: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].ffill().apply(norm_hn)

    cols = list(df.columns)

    def find_col_norm(keys: list[str]) -> str | None:
        norm_keys = [re.sub(r"\s+", "", k) for k in keys]
        for c in cols:
            s = re.sub(r"\s+", "", str(c))
            if any(k in s for k in norm_keys):
                return c
        return None

    result_col = find_col_norm(["สรุปผลตรวจอุจจาระ", "สรุปผล"])
    explanation_col = find_col_norm(["คำอธิบายการแปลผล"])

    if result_col is None and explanation_col is None:
        if from_bill:
            out = pd.DataFrame({
                "HN": df["HN"],
                "ExamItem": "ตรวจอุจจาระ",
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
        raise ValueError(
            f"อุจจาระStool Exam: Missing summary column. Available: {list(df.columns)}"
        )

    if result_col is not None:
        result_series = df[result_col].apply(cell_to_str)
    else:
        result_series = pd.Series([""] * len(df), index=df.index)

    if explanation_col is not None:
        explanation_series = df[explanation_col].apply(cell_to_str)
        result_series = result_series.mask(
            result_series.str.strip().eq(""),
            explanation_series,
        )

    df = df.assign(Result=result_series)
    df = df[df["HN"].notna()].copy()

    def first_non_empty(series: pd.Series) -> str:
        for value in series:
            text = cell_to_str(value)
            if text:
                return text
        return ""

    grouped = df.groupby("HN")["Result"].apply(first_non_empty).reset_index()
    grouped["ExamItem"] = "ตรวจอุจจาระ"

    out = grouped.merge(people, on="HN", how="left")

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
