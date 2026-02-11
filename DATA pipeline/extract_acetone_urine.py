import pandas as pd
import re

from helpers import load_sheet_or_bill, fixed_concat_by_cols, norm_hn, pick_col_contains_any, read_bill_table

TH_ACETONE_ITEM = "ตรวจสารอะซิโตนในปัสสาวะ"
TH_NORMAL = "ปกติ"
TH_ABNORMAL = "ผิดปกติ"


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


def _calc_acetone_summary(value):
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
    return TH_ABNORMAL if num > 25 else TH_NORMAL


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


def extract_acetone_urine(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    year = _detect_year_token(path)
    if year in ("67", "68") and "Bill" in xls.sheet_names:
        df = read_bill_table(path)
        from_bill = True
    else:
        df, from_bill = load_sheet_or_bill(path, xls, "สารAcetone")
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "รหัสพนักงาน", "SCG", "Employee"],
        )
        if hn_col is None and "col_2" in df.columns:
            hn_col = "col_2"
        if hn_col is None:
            raise ValueError("สารAcetone: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    value_col = _find_col_norm(cols, ["อะซิโตนในปัสสาวะ", "Acetone", "mg/L"])
    summary_col = _find_col_norm(cols, ["สรุปผลการตรวจ", "สรุปผล"])
    if value_col is None:
        if from_bill:
            out = pd.DataFrame({
                "HN": df["HN"],
                "ExamItem": TH_ACETONE_ITEM,
                "Result": "",
            }).merge(people, on="HN", how="left")
            return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
        raise ValueError(f"Acetone: Cannot find required columns. Available: {cols}")

    if from_bill and year in ("67", "68"):
        try:
            idx = cols.index(value_col)
            if idx + 1 < len(cols):
                summary_col = cols[idx + 1]
        except ValueError:
            summary_col = None

    if year == "66":
        summary = df[value_col].apply(_calc_acetone_summary)
        result = pd.DataFrame({"v": df[value_col], "s": summary}).apply(
            lambda r: _concat_or_empty(r, ["v", "s"]), axis=1
        )
    else:
        if summary_col is None:
            result = df.apply(lambda r: _concat_or_empty(r, [value_col]), axis=1)
        else:
            result = df.apply(lambda r: _concat_or_empty(r, [value_col, summary_col]), axis=1)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_ACETONE_ITEM,
        "Result": result,
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
