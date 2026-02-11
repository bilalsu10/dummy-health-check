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


def _empty_result(people: pd.DataFrame) -> pd.DataFrame:
    out = pd.DataFrame({
        "HN": people["HN"],
        "ExamItem": "ตรวจสารหนูในปัสสาวะ",
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


def extract_arsenic_urine(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    try:
        sheet = None
        for candidate in ["สารหนูArsenic", "Urine Arsenic", "Arsenic", "สารหนู"]:
            try:
                sheet = resolve_sheet(xls, candidate)
                break
            except Exception:
                continue
        if sheet is None:
            raise ValueError("Arsenic sheet not found")
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
    value_col = _find_col_norm(
        cols,
        [
            "สารหนูในปัสสาวะ",
            "Arsenic in urine",
            "Arsenic",
            "Exposed",
            "ug/L",
            "ug/g",
            "µg/L",
            "µg/g",
            "μg/L",
            "μg/g",
            "<35",
            "<15",
        ],
    )
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล", "ผลตรวจ"])
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
        "ExamItem": "ตรวจสารหนูในปัสสาวะ",
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
