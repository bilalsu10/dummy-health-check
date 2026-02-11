import pandas as pd
import re

from helpers import resolve_sheet, fixed_concat_by_cols, norm_hn, pick_col_contains_any, read_sheet_data_block, read_bill_table

TH_LIVER = "\u0e15\u0e23\u0e27\u0e08\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e15\u0e31\u0e1a"
TH_LIVER_SHEET = "\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e15\u0e31\u0e1a"
TH_LIVER_NORMAL = "\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e15\u0e31\u0e1a\u0e1b\u0e01\u0e15\u0e34"
TH_LIVER_ABNORMAL = "\u0e01\u0e32\u0e23\u0e17\u0e33\u0e07\u0e32\u0e19\u0e02\u0e2d\u0e07\u0e15\u0e31\u0e1a\u0e1c\u0e34\u0e14\u0e1b\u0e01\u0e15\u0e34"


def _to_num(x):
    try:
        return float(str(x).strip())
    except Exception:
        return None


def _is_abnormal(val):
    s = str(val).strip()
    if "\u0e1c\u0e34\u0e14\u0e1b\u0e01\u0e15\u0e34" in s:
        return True
    if "\u0e1b\u0e01\u0e15\u0e34" in s:
        return False
    num = _to_num(val)
    if num is None:
        return False
    return num > 50


def _detect_year(path: str) -> str:
    name = path.replace(" ", "")
    m = re.search(r"256(5|6|7|8)", name)
    if m:
        return m.group(0)
    m = re.search(r"(?<!\d)(6[5-8])(?!\d)", name)
    if m:
        return f"25{m.group(1)}"
    return ""


def _merge_liver_values(path: str, xls: pd.ExcelFile, df_bill: pd.DataFrame, sgot_col: str, sgpt_col: str) -> pd.DataFrame:
    try:
        sheet = resolve_sheet(xls, TH_LIVER_SHEET)
    except Exception:
        try:
            sheet = resolve_sheet(xls, "SGOT&SGPT")
        except Exception:
            return df_bill

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            return df_bill
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    sgot_src = pick_col_contains_any(cols, ["SGOT", "AST"])
    sgpt_src = pick_col_contains_any(cols, ["SGPT", "ALT"])
    if sgot_src is None or sgpt_src is None:
        return df_bill

    lookup = df[["HN", sgot_src, sgpt_src]].drop_duplicates(subset=["HN"], keep="first")
    lookup = lookup.rename(columns={sgot_src: "__SGOT_SRC__", sgpt_src: "__SGPT_SRC__"})

    merged = df_bill.merge(lookup, on="HN", how="left")
    merged[sgot_col] = merged[sgot_col].where(
        merged[sgot_col].notna(),
        merged["__SGOT_SRC__"],
    )
    merged[sgpt_col] = merged[sgpt_col].where(
        merged[sgpt_col].notna(),
        merged["__SGPT_SRC__"],
    )
    merged = merged.drop(columns=["__SGOT_SRC__", "__SGPT_SRC__"])
    return merged


def _derive_summary_or_blank(sgot_val, sgpt_val):
    if _to_num(sgot_val) is None and _to_num(sgpt_val) is None:
        return ""
    abnormal = _is_abnormal(sgot_val) or _is_abnormal(sgpt_val)
    return TH_LIVER_ABNORMAL if abnormal else TH_LIVER_NORMAL


def extract_liver(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    year = _detect_year(path)
    use_bill = year in ("2567", "2568") and "Bill" in xls.sheet_names

    if use_bill:
        df = read_bill_table(path)
        cols = list(df.columns)
        emp_col = pick_col_contains_any(cols, ["รหัสพนักงาน", "รหัส", "Employee ID", "HN", "H.N."]) or "col_2"
        if emp_col not in df.columns:
            emp_col = None
            emp_pattern = re.compile(r"^\d{4}-\d{6}$")
            for c in cols:
                series = df[c].astype(str).str.strip()
                if series.apply(lambda v: bool(emp_pattern.match(v))).sum() > 0:
                    emp_col = c
                    break
            if emp_col is None:
                raise ValueError("Liver (Bill): cannot find employee id column.")
        df = df.rename(columns={emp_col: "HN"})
        df["HN"] = df["HN"].apply(norm_hn)

        sgot_col = pick_col_contains_any(cols, ["SGOT", "AST"])
        sgpt_col = pick_col_contains_any(cols, ["SGPT", "ALT"])
        if sgot_col is None or sgpt_col is None:
            raise ValueError("Liver (Bill): SGOT/SGPT not found.")

        # If Bill lacks SGOT/SGPT values, pull from liver sheet
        df = _merge_liver_values(path, xls, df, sgot_col, sgpt_col)

        derived = []
        for _, row in df.iterrows():
            derived.append(_derive_summary_or_blank(row.get(sgot_col), row.get(sgpt_col)))
        df["__SUMMARY_DERIVED__"] = derived
        summary_col_use = "__SUMMARY_DERIVED__"

    else:
        sheet = resolve_sheet(xls, TH_LIVER_SHEET)
        df = read_sheet_data_block(path, sheet)
        if "HN" not in df.columns:
            hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
            if hn_col is None:
                raise ValueError("Liver: HN column not found.")
            df = df.rename(columns={hn_col: "HN"})
        df["HN"] = df["HN"].apply(norm_hn)

        cols = list(df.columns)
        sgot_col = pick_col_contains_any(cols, ["SGOT", "AST"])
        sgpt_col = pick_col_contains_any(cols, ["SGPT", "ALT"])
        summary_col = pick_col_contains_any(cols, ["\u0e2a\u0e23\u0e38\u0e1b\u0e1c\u0e25", "\u0e1c\u0e25\u0e15\u0e23\u0e27\u0e08", "\u0e1c\u0e25\u0e01\u0e32\u0e23\u0e15\u0e23\u0e27\u0e08"])
        if None in (sgot_col, sgpt_col, summary_col):
            raise ValueError(f"Liver: Cannot detect required columns. Available: {cols}")

        summary_col_use = summary_col

    # Always keep ALKP slot blank to preserve commas
    blank_col = "__ALKP_BLANK__"
    df[blank_col] = ""

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_LIVER,
        "Result": fixed_concat_by_cols(df, [sgot_col, sgpt_col, blank_col, summary_col_use]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
