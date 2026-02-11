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


def _parse_number(value: object) -> float | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return None
    text = text.replace(",", "")
    if text.startswith("<"):
        text = text[1:]
    try:
        return float(text)
    except ValueError:
        return None


def extract_cadmium_blood(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "สารCadmium"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("สารCadmium: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)

    # TL Bill sheet mapping (number + computed result)
    bill_df = None
    bill_cols: list[str] = []
    try:
        bill_sheet = resolve_sheet(xls, "Bill")
        bill_df = read_sheet_data_block(path, bill_sheet)
        bill_cols = list(bill_df.columns)
    except Exception:
        bill_df = None

    if "\\TL\\" in path and bill_df is not None:
        value_col = pick_col_contains_any(bill_cols, ["Cadmium", "แคดเมียม", "Blood Cadmium"])
        if value_col:
            hn_col = "HN" if "HN" in bill_df.columns else pick_col_contains_any(list(bill_df.columns), ["HN", "H.N."])
            if hn_col and hn_col != "HN":
                bill_df = bill_df.rename(columns={hn_col: "HN"})
            bill_df["HN"] = bill_df["HN"].apply(norm_hn)

            def make_result(v: object) -> str:
                num = _parse_number(v)
                if num is None:
                    return ""
                status = "ผิดปกติ" if num >= 5 else "ปกติ"
                return f"{num},{status}"

            out = pd.DataFrame({
                "HN": bill_df["HN"],
                "ExamItem": "ตรวจสารแคดเมียมในเลือด",
                "Result": bill_df[value_col].apply(make_result),
            }).merge(people, on="HN", how="left")
            return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]

    value_col = _find_col_norm(cols, ["Cadmium", "แคดเมียม", "ug/L", "µg/L", "<5"])
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล", "ผลการตรวจ"])
    if value_col is None:
        raise ValueError(f"Cadmium: Cannot find required columns. Available: {cols}")

    if summary_col is None:
        def make_result(v: object) -> str:
            num = _parse_number(v)
            if num is None:
                return ""
            status = "ผิดปกติ" if num >= 5 else "ปกติ"
            return f"{num},{status}"
        result_series = df[value_col].apply(make_result)
    else:
        result_series = fixed_concat_by_cols(df, [value_col, summary_col])

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจสารแคดเมียมในเลือด",
        "Result": result_series,
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
