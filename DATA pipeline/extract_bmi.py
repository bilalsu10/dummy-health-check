import pandas as pd
import re

from helpers import resolve_sheet, fixed_concat_by_cols, norm_hn, pick_col_contains_any, read_sheet_data_block

# Thai literals via unicode escapes (avoid encoding issues)
TH_BP_BMI = "ความดันโลหิต+ดัชนีมวลกาย"
TH_BMI = "ดัชนีมวลกาย"
TH_RESULT = "ผลการตรวจ"
TH_INTERPRET = "แปลผลดัชนีมวลกาย"
TH_NORMAL = "ค่าปกติ"
TH_FIT = "สมส่วน"
TH_OVER = "เกินเกณฑ์"


def extract_bmi(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    # Prefer dedicated BMI sheet (TL)
    sheet = None
    for candidate in ["BMI ", "BMI", TH_BMI]:
        try:
            sheet = resolve_sheet(xls, candidate)
            break
        except Exception:
            continue
    if sheet is None:
        sheet = resolve_sheet(xls, TH_BP_BMI)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError(f"{TH_BP_BMI}: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)

    def find_col_norm(cols_in, keys):
        norm_keys = [re.sub(r"\s+", "", k) for k in keys]
        for c in cols_in:
            s = re.sub(r"\s+", "", str(c))
            if any(k in s for k in norm_keys):
                return c
        return None

    bmi_value_col = find_col_norm(cols, [TH_BMI, "BMI"])
    bmi_text_col = find_col_norm(cols, [TH_RESULT, "?????????"])
    if bmi_text_col is None:
        bmi_text_col = find_col_norm(cols, [TH_INTERPRET, TH_NORMAL, TH_FIT, TH_OVER])

    if bmi_value_col is None or bmi_text_col is None:
        raise ValueError(f"BMI: Cannot detect 2 columns. Available columns: {cols}")

    def format_bmi(value):
        numeric = pd.to_numeric(value, errors="coerce")
        if pd.isna(numeric):
            return ""
        return f"{numeric:.2f}"

    df[bmi_value_col] = df[bmi_value_col].apply(format_bmi)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_BMI,
        "Result": fixed_concat_by_cols(df, [bmi_value_col, bmi_text_col]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
