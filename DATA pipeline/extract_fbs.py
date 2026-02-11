import pandas as pd
import re

from helpers import resolve_sheet, fixed_concat_by_cols, norm_hn, pick_col_contains_any, read_sheet_data_block

# Thai literals via unicode escapes
TH_SHEET = "\u0e44\u0e02\u0e21\u0e31\u0e19\u0e41\u0e25\u0e30\u0e19\u0e49\u0e33\u0e15\u0e32\u0e25\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14"
TH_FBS = "\u0e15\u0e23\u0e27\u0e08\u0e19\u0e49\u0e33\u0e15\u0e32\u0e25\u0e43\u0e19\u0e40\u0e25\u0e37\u0e2d\u0e14"


def _find_col_norm(cols, keys):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if any(k in s for k in norm_keys):
            return c
    return None


def extract_fbs(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = None
    for candidate in [TH_SHEET, "FBS", "Sugar"]:
        try:
            sheet = resolve_sheet(xls, candidate)
            break
        except Exception:
            continue
    if sheet is None:
        sheet = resolve_sheet(xls, TH_SHEET)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N.", "\u0e23\u0e2b\u0e31\u0e2a\u0e1e\u0e19\u0e31\u0e01\u0e07\u0e32\u0e19"])
        if hn_col is None:
            raise ValueError("FBS: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)

    # 2 columns for FBS (value + summary text)
    fbs_value_col = _find_col_norm(cols, ["\u0e19\u0e49\u0e33\u0e15\u0e32\u0e25", "FBS", "Sugar"])
    fbs_summary_col = _find_col_norm(cols, ["\u0e2a\u0e23\u0e38\u0e1b", "\u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08", "\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08", "\u0e19\u0e49\u0e33\u0e15\u0e32\u0e25"])
    if fbs_value_col is None or fbs_summary_col is None:
        raise ValueError(f"FBS: Cannot detect 2 columns. Available columns: {cols}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_FBS,
        "Result": fixed_concat_by_cols(df, [fbs_value_col, fbs_summary_col]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
