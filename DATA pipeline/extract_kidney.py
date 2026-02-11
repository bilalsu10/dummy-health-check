import pandas as pd
import re

from helpers import (
    resolve_sheet,
    norm_hn,
    pick_col_contains_any,
    read_sheet_data_block,
    read_bill_table,
)

TH_KIDNEY = "ตรวจการทำงานของไต"
TH_SUM = "สรุป"
TH_RESULT = "ผลตรวจ"
TH_RESULT_LONG = "ผลการตรวจ"
TH_NORMAL = "ปกติ"
TH_ABNORMAL = "การทำงานของไตผิดปกติ"
TH_MALE = "ชาย"
TH_FEMALE = "หญิง"


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


def _find_col_norm(cols, keys, exclude=None):
    norm_keys = [re.sub(r"\s+", "", k) for k in keys]
    norm_exclude = [re.sub(r"\s+", "", k) for k in (exclude or [])]
    for c in cols:
        s = re.sub(r"\s+", "", str(c))
        if norm_exclude and any(k in s for k in norm_exclude):
            continue
        if any(k in s for k in norm_keys):
            return c
    return None


def _find_summary_by_label(cols, token):
    for c in cols:
        s = str(c)
        if token in s and "mg" not in s and "(" not in s:
            return c
    return None


def _detect_year_token(path: str) -> str:
    name = path.replace(" ", "")
    for token in ["2568", "2567", "2566", "2565", "68", "67", "66", "65"]:
        if token in name:
            return token[-2:]
    return "unknown"


def _infer_hn_col_from_people(df: pd.DataFrame, people: pd.DataFrame):
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


def _summary_from_kidney_sheets(path: str, xls: pd.ExcelFile) -> pd.DataFrame:
    def _read_summary(sheet_name: str):
        sheet = resolve_sheet(xls, sheet_name)
        df = read_sheet_data_block(path, sheet)
        if "HN" not in df.columns:
            hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N.", "SCG EmpID", "SCG_EmpID", "Employee ID"])
            if hn_col is None:
                return None
            df = df.rename(columns={hn_col: "HN"})
        df["HN"] = df["HN"].apply(norm_hn)
        sum_col = _find_col_norm(list(df.columns), [TH_SUM, TH_RESULT, TH_RESULT_LONG])
        if sum_col is None:
            return None
        out = df[["HN", sum_col]].copy()
        out = out.rename(columns={sum_col: "Summary"})
        return out

    bun_sum = None
    cre_sum = None
    for name in ["BUN", "Bun", "Kidney", TH_KIDNEY]:
        try:
            bun_sum = _read_summary(name)
            if bun_sum is not None:
                break
        except Exception:
            continue
    for name in ["Cre", "Crea", "Creatinine", "Kidney", TH_KIDNEY]:
        try:
            cre_sum = _read_summary(name)
            if cre_sum is not None:
                break
        except Exception:
            continue

    if bun_sum is None and cre_sum is None:
        return pd.DataFrame(columns=["HN", "Summary"])

    if bun_sum is None:
        return cre_sum
    if cre_sum is None:
        return bun_sum

    merged = bun_sum.merge(cre_sum, on="HN", how="outer", suffixes=("_bun", "_cre"))
    merged["Summary"] = merged["Summary_cre"].fillna(merged["Summary_bun"])
    return merged[["HN", "Summary"]]


def _normalize_sex(value: str) -> str:
    s = str(value).strip()
    if s in (TH_MALE, "ช", "M", "Male"):
        return "M"
    if s in (TH_FEMALE, "ญ", "F", "Female"):
        return "F"
    return ""


def _calc_kidney_status(bun_val, cre_val, sex_token: str) -> str:
    try:
        bun = float(str(bun_val).strip())
    except Exception:
        bun = None
    try:
        cre = float(str(cre_val).strip())
    except Exception:
        cre = None

    bun_abnormal = bun is not None and (bun < 8 or bun > 20)

    if sex_token == "M":
        low, high = 0.72, 1.18
    elif sex_token == "F":
        low, high = 0.55, 1.02
    else:
        low, high = 0.55, 1.18

    cre_abnormal = cre is not None and (cre < low or cre > high)

    if bun_abnormal or cre_abnormal:
        return TH_ABNORMAL
    if bun is None and cre is None:
        return ""
    return TH_NORMAL


def _normalize_summary_text(value: str, bun_val, cre_val, sex_token: str) -> str:
    s = str(value).strip()
    if TH_ABNORMAL in s:
        return TH_ABNORMAL
    if TH_NORMAL in s:
        return TH_NORMAL
    return _calc_kidney_status(bun_val, cre_val, sex_token)


def _build_from_bill(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    df = read_bill_table(path)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N.", "SCG EmpID", "SCG_EmpID", "Employee ID"])
        if hn_col is None:
            hn_col = _infer_hn_col_from_people(df, people)
        if hn_col is None:
            raise ValueError("Kidney Bill: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    bun_col = _find_col_norm(cols, ["BUN", "Bun"], exclude=[TH_SUM, "Summary"])
    cr_col = _find_col_norm(cols, ["Crea", "Creatinine"], exclude=[TH_SUM, "Summary"])

    if bun_col is None or cr_col is None:
        raise ValueError(f"Kidney Bill: Cannot find BUN/Crea columns. Available: {cols}")

    summary_bun = _find_col_norm(cols, [f"{TH_SUM}Bun", f"{TH_SUM} BUN", "SummaryBun", "Summary Bun"])
    summary_cre = _find_col_norm(cols, [f"{TH_SUM}Cre", f"{TH_SUM} Crea", "SummaryCre", "Summary Cre"])
    if summary_bun is None:
        summary_bun = _find_summary_by_label(cols, "Bun")
    if summary_cre is None:
        summary_cre = _find_summary_by_label(cols, "Cre")

    year = _detect_year_token(path)
    sex_map = people[["HN", "Sex"]].copy()
    sex_map["Sex"] = sex_map["Sex"].map(_normalize_sex)
    merged = df[["HN", bun_col, cr_col]].merge(sex_map, on="HN", how="left")

    if year == "66":
        summary_series = merged.apply(lambda r: _calc_kidney_status(r[bun_col], r[cr_col], r["Sex"]), axis=1)
        temp = pd.DataFrame({
            "_bun": df[bun_col],
            "_cre": df[cr_col],
            "_sum": summary_series,
        })
        result = temp.apply(lambda r: _concat_or_empty(r, ["_bun", "_cre", "_sum"]), axis=1)
    else:
        summary_col = summary_cre or summary_bun
        if summary_col is not None:
            summary_raw = df[summary_col]
        else:
            summary_df = _summary_from_kidney_sheets(path, xls)
            summary_raw = df[["HN"]].merge(summary_df, on="HN", how="left")["Summary"] if not summary_df.empty else ""

        summary_series = merged.apply(
            lambda r: _normalize_summary_text(summary_raw.iloc[r.name] if hasattr(summary_raw, "iloc") else summary_raw, r[bun_col], r[cr_col], r["Sex"]),
            axis=1,
        )

        temp = pd.DataFrame({
            "_bun": df[bun_col],
            "_cre": df[cr_col],
            "_sum": summary_series,
        })
        result = temp.apply(lambda r: _concat_or_empty(r, ["_bun", "_cre", "_sum"]), axis=1)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_KIDNEY,
        "Result": result,
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


def extract_kidney(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    if "Bill" in xls.sheet_names:
        return _build_from_bill(path, xls, people)

    sheet = TH_KIDNEY
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("?????????????????: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    bun_col = _find_col_norm(cols, ["BUN", "Bun"], exclude=[TH_SUM, "Summary"])
    cr_col = _find_col_norm(cols, ["Creatinine", "Crea", "Cr"], exclude=[TH_SUM, "Summary"])
    summary_col = _find_col_norm(cols, [TH_SUM, TH_RESULT, TH_RESULT_LONG])
    if bun_col is None or cr_col is None:
        raise ValueError(f"Kidney: Cannot find required columns. Available: {cols}")

    year = _detect_year_token(path)
    if year == "66":
        result = df.apply(lambda r: _concat_or_empty(r, [bun_col, cr_col, "__missing__"]), axis=1)
    else:
        if summary_col is None:
            result = df.apply(lambda r: _concat_or_empty(r, [bun_col, cr_col, "__missing__"]), axis=1)
        else:
            result = df.apply(lambda r: _concat_or_empty(r, [bun_col, cr_col, summary_col]), axis=1)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": TH_KIDNEY,
        "Result": result,
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
