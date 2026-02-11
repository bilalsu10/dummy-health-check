import pandas as pd
import re
from typing import List, Optional


# =========================
# Helpers
# =========================
def norm_hn(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    s = re.sub(r"\s+", "", s)
    return s.replace("–", "-")


def to_number(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    if s == "":
        return None
    try:
        return int(float(s))
    except:
        return None


def cell_to_str(v):
    """Keep position; treat NaN / '-' as empty string."""
    if pd.isna(v):
        return ""
    s = str(v).strip()
    return "" if s == "-" else s


def _normalize_sheet_name(name: str) -> str:
    s = str(name).strip().lower()
    s = re.sub(r"\s+", "", s)
    return re.sub(r"[\\-\\+\\(\\)\\./]", "", s)


SHEET_ALIASES = {
    "ความดันโลหิต+ดัชนีมวลกาย": [
        ["ความดันโลหิต", "ดัชนีมวลกาย"],
        ["BMI+BP"],
        ["BMI", "BP"],
        ["BP"],
        ["BMI"],
        ["ความดันโลหิต"],
        ["ดัชนีมวลกาย"],
    ],
    "ไขมันและน้ำตาลในเลือด": [
        ["ไขมัน", "น้ำตาล"],
        ["ไขมัน+น้ำตาล"],
        ["Sugar"],
    ],
    "การทำงานของตับ": [
        ["การทำงานของตับ"],
        ["SGOT", "SGPT"],
        ["SGOT"],
        ["SGPT"],
    ],
    "การทำงานของไต": [
        ["การทำงานของไต"],
        ["BUN", "Cre"],
        ["BUN"],
        ["Cre"],
        ["eGFR"],
    ],
    "กรดยูริคในเลือด": [
        ["กรดยูริค"],
        ["Uric"],
        ["UA"],
    ],
    "ความสมบูรณ์ของเลือด": [
        ["ความสมบูรณ์ของเลือด"],
        ["CBC"],
    ],
    "ปัสสาวะสมบูรณ์แบบ": [
        ["ปัสสาวะสมบูรณ์แบบ"],
        ["ปัสสาวะ", "UA"],
        ["Urine"],
        ["UA"],
    ],
    "สารเสพติดในปัสสาวะ": [
        ["สารเสพติดในปัสสาวะ"],
        ["สารเสพติด", "Amp"],
        ["Amphetamine"],
    ],
    "อุจจาระStool Exam": [
        ["อุจจาระ"],
        ["Stool"],
    ],
    "เอกซเรย์ปอด": [
        ["เอกซเรย์ปอด"],
        ["CXR"],
        ["Xray"],
        ["X-ray"],
        ["xray"],
        ["x-ray"],
    ],
    "คลื่นไฟฟ้าหัวใจ": [
        ["คลื่นไฟฟ้าหัวใจ"],
        ["EKG"],
        ["Ekg"],
    ],
    "สมรรถภาพการได้ยิน": [
        ["สมรรถภาพการได้ยิน"],
        ["การได้ยิน"],
    ],
    "สมรรถภาพปอด": [
        ["สมรรถภาพปอด"],
        ["ปอด"],
    ],
    "สมรรถภาพกล้ามเนื้อMuscle": [
        ["สมรรถภาพกล้ามเนื้อ"],
        ["กล้ามเนื้อ"],
        ["Muscle"],
    ],
    "สายตาระยะไกลVA": [
        ["สายตาระยะไกล"],
        ["VA"],
        ["สายตา"],
    ],
    "ตาอาชีวอนามัย": [
        ["ตาอาชีวอนามัย"],
        ["สายตา"],
    ],
    "มะเร็งต่อมลูกหมาก": [
        ["มะเร็งต่อมลูกหมาก"],
        ["PSA"],
    ],
    "สารตะกั่วในเลือดLead": [
        ["สารตะกั่ว", "Lead"],
        ["สารLead"],
        ["Lead(G)"],
        ["Lead"],
    ],
    "สารหนูArsenic": [
        ["สารหนู", "Arsenic"],
        ["สารหนู"],
        ["Arsenic(G)"],
        ["Arsenic"],
    ],
    "สารAcetone": [
        ["สารAcetone"],
        ["Acetone(G)"],
        ["Acetone"],
    ],
    "สารMercury": [
        ["สารMercury"],
        ["Mercury(G)"],
        ["Mercury"],
    ],
    "สารChromium": [
        ["สารChromium"],
        ["Chromium(G)"],
        ["Chromium"],
    ],
    "สารXylene": [
        ["สารXylene"],
        ["Xylene(G)"],
        ["Xylene"],
    ],
    "สารMethyl": [
        ["สารMethyl"],
        ["Methy(G)"],
        ["Methyl"],
        ["Methy"],
    ],
    "สารCadmium": [
        ["สารCadmium"],
        ["Cadmium(G)"],
        ["Cadmium"],
    ],
    "สารToluene": [
        ["สารToluene"],
        ["Toluene(G)"],
        ["Toluene"],
    ],
    "สารPhenol": [
        ["สารPhenol"],
        ["Phenol(G)"],
        ["Phenol"],
    ],
}


def resolve_sheet(xls: pd.ExcelFile, canonical_name: str) -> str:
    if canonical_name in xls.sheet_names:
        return canonical_name

    candidates = SHEET_ALIASES.get(canonical_name, [[canonical_name]])
    for group in candidates:
        norm_group = [_normalize_sheet_name(k) for k in group]
        for sheet in xls.sheet_names:
            norm_sheet = _normalize_sheet_name(sheet)
            if all(k in norm_sheet for k in norm_group):
                return sheet

    raise ValueError(f"Sheet not found: '{canonical_name}'. Available sheets: {xls.sheet_names}")


def ensure_sheet(xls: pd.ExcelFile, sheet_name: str):
    resolve_sheet(xls, sheet_name)


def pick_col_contains_all(cols: List[str], must_have: List[str]) -> Optional[str]:
    for c in cols:
        s = str(c)
        if all(k in s for k in must_have):
            return c
    return None


def pick_col_contains_any(cols: List[str], any_of: List[str]) -> Optional[str]:
    for c in cols:
        s = str(c)
        if any(k in s for k in any_of):
            return c
    return None


# =========================
# Read "data block" starting at ลำดับ=1
# (Works for most sheets with a detectable header row)
# =========================
def find_header_row(grid: pd.DataFrame, max_scan: int = 60) -> int:
    # Prefer a row containing "ลำดับ" and "HN" (or "ชื่อ")
    for i in range(min(max_scan, len(grid))):
        row = grid.iloc[i].astype(str).fillna("")
        joined = " | ".join(v.strip() for v in row.values)
        if ("ลำดับ" in joined or "No" in joined) and ("HN" in joined or "ชื่อ" in joined):
            return i
    # Fallback: any row containing "ลำดับ"
    for i in range(min(max_scan, len(grid))):
        row = grid.iloc[i].astype(str).fillna("")
        joined = " | ".join(v.strip() for v in row.values)
        if "ลำดับ" in joined or "No" in joined:
            return i
    raise ValueError("Header row not found (cannot locate 'ลำดับ' or 'No').")


def clean_headers(header_row) -> List[str]:
    headers = []
    for j, h in enumerate(header_row):
        s = str(h).strip()
        if s == "" or s.lower() == "nan":
            s = f"col_{j}"
        headers.append(s)
    # Ensure uniqueness
    seen = {}
    out = []
    for h in headers:
        if h not in seen:
            seen[h] = 1
            out.append(h)
        else:
            seen[h] += 1
            out.append(f"{h} ({seen[h]})")
    return out


def slice_data_block_by_lamdup(df: pd.DataFrame, allow_no_start: bool = False) -> pd.DataFrame:
    def pick_lam_col(cols):
        for c in cols:
            s = str(c).strip().replace("\n", "").replace(" ", "")
            if "ลำดับ" in s or s.lower() == "no":
                return c
        return None

    lam_col = pick_lam_col(df.columns)
    if lam_col is None:
        raise ValueError("No 'ลำดับ' or 'No' column after header parsing.")
    lam = df[lam_col].apply(to_number)
    start_candidates = df.index[lam == 1].tolist()
    if not start_candidates:
        if allow_no_start:
            return df.reset_index(drop=True)
        raise ValueError("Cannot find data start row where ลำดับ/No == 1.")
    start_idx = start_candidates[0]

    df2 = df.loc[start_idx:].copy()
    lam2 = df2[lam_col].apply(to_number)
    df2 = df2[lam2.notna()].reset_index(drop=True)
    return df2


def read_sheet_data_block(path: str, sheet_name: str, allow_no_lamdup: bool = False) -> pd.DataFrame:
    grid = pd.read_excel(path, sheet_name=sheet_name, header=None)
    hdr_i = find_header_row(grid)
    header_row = grid.iloc[hdr_i].tolist()
    next_row = grid.iloc[hdr_i + 1].tolist() if hdr_i + 1 < len(grid) else None

    # Some sheets (e.g., eye exam) use a 2-row header: top has section titles, next has real columns.
    if next_row is not None:
        top_vals = [str(v).strip() for v in header_row]
        next_vals = [str(v).strip() for v in next_row]
        has_hn = any("HN" == v for v in top_vals)
        has_org_cols = any(v in ("Position", "Section", "Department", "Division") for v in next_vals)
        if has_hn and has_org_cols:
            merged = []
            for t, n in zip(top_vals, next_vals):
                val = n if n not in ("", "nan") else t
                merged.append(val)
            header_row = merged
            data_start = hdr_i + 2
        else:
            data_start = hdr_i + 1
    else:
        data_start = hdr_i + 1

    headers = clean_headers(header_row)
    df = grid.iloc[data_start:].copy()
    df.columns = headers
    df = df.dropna(how="all").reset_index(drop=True)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(
            list(df.columns),
            ["HN", "H.N.", "รหัสพนักงาน", "Employee ID", "SCG Employee ID", "รหัสพนักงาน"],
        )
        if hn_col is not None:
            df["HN"] = df[hn_col]
    return slice_data_block_by_lamdup(df, allow_no_start=allow_no_lamdup)


def read_bill_table(path: str, sheet_name: str = "Bill") -> pd.DataFrame:
    grid = pd.read_excel(path, sheet_name=sheet_name, header=None)
    hdr_i = None
    for i in range(min(40, len(grid))):
        row = grid.iloc[i].astype(str).fillna("")
        joined = " | ".join(v.strip() for v in row.values)
        if "Systolic BP" in joined and "BMI" in joined:
            hdr_i = i
            break
    if hdr_i is None:
        for i in range(min(60, len(grid))):
            row = grid.iloc[i].astype(str).fillna("")
            joined = " | ".join(v.strip() for v in row.values)
            if "Systolic" in joined or "BMI" in joined:
                hdr_i = i
                break
    if hdr_i is None:
        raise ValueError("Bill: header row not found.")

    headers = clean_headers(grid.iloc[hdr_i].tolist())
    df = grid.iloc[hdr_i + 1 :].copy()
    df.columns = headers
    df = df.dropna(how="all").reset_index(drop=True)
    if "col_1" in df.columns:
        lam = df["col_1"].apply(to_number)
        df = df[lam.notna()].reset_index(drop=True)
    return df


def load_sheet_or_bill(path: str, xls: pd.ExcelFile, canonical_name: str):
    try:
        sheet = resolve_sheet(xls, canonical_name)
    except ValueError:
        if "Bill" not in xls.sheet_names:
            raise
        return read_bill_table(path), True
    return read_sheet_data_block(path, sheet), False


# =========================
# Special read for hearing (fixed by column indices 10..26 inclusive)
# Still respects "start at ลำดับ=1"
# =========================
def read_hearing_grid_block(path: str, sheet_name: str) -> pd.DataFrame:
    grid = pd.read_excel(path, sheet_name=sheet_name, header=None)

    # Find lam_col_idx by locating "ลำดับ" in the top area; fallback to col 0
    lam_col_idx = None
    for col_idx in range(min(10, grid.shape[1])):
        top = grid.iloc[:60, col_idx].astype(str)
        if top.str.contains(r"^ลำดับ$", na=False).any():
            lam_col_idx = col_idx
            break
    if lam_col_idx is None:
        lam_col_idx = 0

    lam = grid.iloc[:, lam_col_idx].apply(to_number)
    start_row = lam[lam == 1].index[0]

    data = grid.iloc[start_row:].copy()
    lam2 = data.iloc[:, lam_col_idx].apply(to_number)
    data = data[lam2.notna()].reset_index(drop=True)

    # Name columns as their numeric indices to slice reliably
    data.columns = list(range(data.shape[1]))
    return data


# =========================
# Result builders (fixed-position, commas preserved)
# =========================
def fixed_concat_by_cols(df: pd.DataFrame, cols_in_order: List[str]) -> pd.Series:
    def row_fn(r):
        return ",".join(cell_to_str(r[c]) if c in df.columns else "" for c in cols_in_order)
    return df.apply(row_fn, axis=1)


def fixed_concat_by_indices(df_grid: pd.DataFrame, idxs_in_order: List[int]) -> pd.Series:
    def row_fn(r):
        return ",".join(cell_to_str(r[i]) if i in r.index else "" for i in idxs_in_order)
    return df_grid.apply(row_fn, axis=1)
