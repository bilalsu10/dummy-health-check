from __future__ import annotations

import re
from pathlib import Path
from typing import Optional

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
RAW_DIR = BASE_DIR / "raw" / "KK" / "raw"
FINAL_DIR = BASE_DIR / "raw" / "KK" / "Final"


FINAL_COLUMNS = [
    "RowNo",
    "HN",
    "SCG_EmpID",
    "Name",
    "DOB",
    "Age",
    "Position",
    "Section",
    "Department",
    "Division",
    "Sex",
    "Occupational Vision Exam",
    "Hearing Test",
    "BMI",
    "Urine Arsenic",
    "Blood Pressure",
    "Blood Glucose",
    "Liver Function",
    "Kidney Function",
    "Uric Acid",
    "PSA (Prostate Specific Antigen)",
    "Amphetamine",
    "Blood Lead",
    "Urine Acetone",
    "Urine Mercury",
    "Urine Toluene",
    "Blood Cadmium",
    "Urine Xylene",
    "Urine Methyl Ethyl Ketone",
    "Urine Phenol",
    "CBC",
    "EKG",
    "Lung Function",
    "Stool Exam",
    "Urinalysis",
    "VA",
    "Chest X-ray",
]


EMPID_PATTERN = re.compile(r"^\d{4}-\d{6}$")


def norm_text(v: object) -> str:
    if pd.isna(v):
        return ""
    return str(v).strip()


def normalize_empid(v: object) -> str:
    t = norm_text(v)
    if not t:
        return ""
    m = re.match(r"^(\d{1,4})-(\d{1,6})$", t)
    if m:
        left = m.group(1).zfill(4)
        right = m.group(2).zfill(6)
        return f"{left}-{right}"
    return t


def pick_col(cols: list[str], keywords: list[str]) -> Optional[str]:
    low_cols = [(c, c.lower()) for c in cols]
    for kw in keywords:
        low_kw = kw.lower()
        for raw, low in low_cols:
            if low_kw in low:
                return raw
    return None


def make_headers(row: pd.Series, next_row: Optional[pd.Series]) -> list[str]:
    headers: list[str] = []
    for idx, v in enumerate(row.tolist()):
        h = norm_text(v)
        if not h and next_row is not None:
            h = norm_text(next_row.iloc[idx])
        if not h:
            h = f"col_{idx}"
        headers.append(h)

    # ensure unique
    used: dict[str, int] = {}
    unique: list[str] = []
    for h in headers:
        n = used.get(h, 0)
        if n == 0:
            unique.append(h)
        else:
            unique.append(f"{h}_{n+1}")
        used[h] = n + 1
    return unique


def score_header_row(grid: pd.DataFrame, r: int) -> int:
    row_vals = [norm_text(v) for v in grid.iloc[r].tolist()]
    joined = " | ".join(row_vals).lower()
    score = 0
    if "รหัสพนักงาน" in joined or "scg employee id" in joined or "รหัส" in joined:
        score += 3
    if "ชื่อ - นามสกุล" in joined or "ชื่อ - สกุล" in joined or "name" in joined:
        score += 3
    if "ตำแหน่ง" in joined or "position" in joined:
        score += 1
    if "เพศ" in joined or "sex" in joined:
        score += 1
    if "อายุ" in joined or "age" in joined:
        score += 1
    if "แผนก" in joined or "department" in joined or "division" in joined:
        score += 1
    return score


def parse_people_from_sheet(path: Path, sheet_name: str) -> pd.DataFrame:
    grid = pd.read_excel(path, sheet_name=sheet_name, header=None)
    if grid.empty:
        return pd.DataFrame()

    candidates = []
    max_scan = min(len(grid), 30)
    for r in range(max_scan):
        score = score_header_row(grid, r)
        if score >= 5:
            candidates.append((score, r))

    best_df = pd.DataFrame()
    best_count = -1
    for _, r in candidates:
        next_row = grid.iloc[r + 1] if r + 1 < len(grid) else None
        headers = make_headers(grid.iloc[r], next_row)
        data = grid.iloc[r + 1 :].copy()
        data.columns = headers
        data = data.dropna(how="all")

        cols = [str(c) for c in data.columns]
        emp_col = pick_col(cols, ["รหัสพนักงาน", "รหัส", "scg employee id", "scg_empid", "scg"])
        name_col = pick_col(cols, ["ชื่อ - นามสกุล", "ชื่อ - สกุล", "name"])
        if not emp_col or not name_col:
            continue

        emp_series = data[emp_col].map(norm_text)
        valid_emp = emp_series.str.match(EMPID_PATTERN, na=False)
        count = int(valid_emp.sum())
        if count <= best_count:
            continue

        age_col = pick_col(cols, ["อายุ", "age"])
        sex_col = pick_col(cols, ["เพศ", "sex", "gender"])
        pos_col = pick_col(cols, ["ตำแหน่งงาน", "ตำแหน่ง", "position"])
        sec_col = pick_col(cols, ["section", "ส่วน", "แยกเหมือง"])
        dept_col = pick_col(cols, ["แผนก", "department", "division (thai)"])
        div_col = pick_col(cols, ["division", "ฝ่าย", "บริษัท", "company"])

        out = pd.DataFrame(
            {
                "SCG_EmpID": emp_series,
                "Name": data[name_col].map(norm_text),
                "Age": data[age_col].map(norm_text) if age_col else "",
                "Sex": data[sex_col].map(norm_text) if sex_col else "",
                "Position": data[pos_col].map(norm_text) if pos_col else "",
                "Section": data[sec_col].map(norm_text) if sec_col else "",
                "Department": data[dept_col].map(norm_text) if dept_col else "",
                "Division": data[div_col].map(norm_text) if div_col else "",
            }
        )
        out = out[valid_emp].copy()
        out["HN"] = out["SCG_EmpID"]
        out["DOB"] = ""
        out = out.drop_duplicates(subset=["SCG_EmpID"], keep="first")
        out["RowNo"] = range(1, len(out) + 1)
        best_df = out
        best_count = count

    return best_df


def extract_people_kk(path: Path) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    best = pd.DataFrame()
    best_count = -1
    for sheet in xls.sheet_names:
        try:
            parsed = parse_people_from_sheet(path, sheet)
        except Exception:
            continue
        if len(parsed) > best_count:
            best = parsed
            best_count = len(parsed)
    if best_count <= 0:
        raise ValueError(f"Cannot parse personal info from: {path.name}")
    return best


def to_final_template(people: pd.DataFrame) -> pd.DataFrame:
    out = people.copy()
    # KK source section is not reliable for final output; keep Section blank.
    out["Section"] = ""
    for c in FINAL_COLUMNS:
        if c not in out.columns:
            out[c] = ""
    out = out[FINAL_COLUMNS].copy()
    out = out.fillna("")
    out["RowNo"] = range(1, len(out) + 1)
    return out


def _build_eye_value(
    far_vision: object,
    eye_3d: object,
    color_test: object,
    near_vision: object,
    eye_balance: object,
    visual_field: object,
    eye_result: object,
    eye_sugg: object = "",
) -> str:
    # Keep 16 slots to stay compatible with existing app parsing.
    def _clean(v: object) -> str:
        # Avoid breaking comma-based index storage.
        return norm_text(v).replace(",", "-")

    parts = [""] * 16
    parts[1] = _clean(far_vision)
    parts[4] = _clean(eye_3d)
    parts[5] = _clean(color_test)
    parts[8] = _clean(near_vision)
    parts[11] = _clean(eye_balance)
    parts[13] = _clean(visual_field)
    parts[14] = _clean(eye_result)
    parts[15] = _clean(eye_sugg)
    return ",".join(parts)


def map_occupational_vision_from_raw(path: Path, final_df: pd.DataFrame) -> pd.DataFrame:
    year_match = re.search(r"(25\d{2})", path.name)
    year = year_match.group(1) if year_match else ""
    xls = pd.ExcelFile(path)

    # KK 2564/2565/2566/2567 eye mapping by fixed Sheet2/Sheet1 positions:
    # id=col 5, eyes=90..96
    if year in {"2564", "2565", "2566", "2567"} and ("Sheet2" in xls.sheet_names or "Sheet1" in xls.sheet_names):
        raw = pd.DataFrame()
        try:
            if "Sheet2" in xls.sheet_names:
                probe = pd.read_excel(path, sheet_name="Sheet2")
                if not probe.empty and len(probe.columns) >= 96:
                    raw = probe
            if raw.empty and "Sheet1" in xls.sheet_names:
                raw = pd.read_excel(path, sheet_name="Sheet1")
        except Exception:
            raw = pd.DataFrame()
        if not raw.empty and len(raw.columns) >= 96:
            raw = raw.copy()
            # 1-based to 0-based
            idx_emp = 4
            idx_far = 89   # การมองระยะไกล
            idx_near = 90  # การมองระยะใกล้
            idx_3d = 91    # มองภาพ 3 มิติ
            idx_color = 92 # การแยกสี
            idx_balance = 93  # ความสมดุลกล้ามเนื้อตา
            idx_field = 94    # ลานสายตา
            idx_result = 95   # สรุปสายตา

            raw["SCG_EmpID"] = raw.iloc[:, idx_emp].map(normalize_empid)
            raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
            raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

            def _cell(r: pd.Series, idx: int) -> str:
                if idx < len(r):
                    return norm_text(r.iloc[idx]).replace(",", "-")
                return ""

            raw["Occupational Vision Exam"] = raw.apply(
                lambda r: _build_eye_value(
                    _cell(r, idx_far),      # index 1
                    _cell(r, idx_3d),       # index 4
                    _cell(r, idx_color),    # index 5
                    _cell(r, idx_near),     # index 8
                    _cell(r, idx_balance),  # index 11
                    _cell(r, idx_field),    # index 13
                    _cell(r, idx_result),   # index 14
                    "",                     # index 15
                ),
                axis=1,
            )
            mapped = raw[["SCG_EmpID", "Occupational Vision Exam"]]
            out = final_df.copy()
            out = out.drop(columns=["Occupational Vision Exam"], errors="ignore")
            out = out.merge(mapped, on="SCG_EmpID", how="left")
            out["Occupational Vision Exam"] = out["Occupational Vision Exam"].fillna("")
            return out[FINAL_COLUMNS]

    # KK 2568 has fixed eye columns by position from sheet "68 Document for table"
    # AD, AH, AI, AL, AJ, AQ, AR, AS with SCG Employee ID.
    if year == "2568" and "68 Document for table" in xls.sheet_names:
        try:
            raw = pd.read_excel(path, sheet_name="68 Document for table")
        except Exception:
            raw = pd.DataFrame()
        if not raw.empty:
            # 1-based to 0-based: AD=29, AH=33, AI=34, AJ=35, AL=37, AQ=42, AR=43, AS=44
            idx_ad = 29
            idx_ah = 33
            idx_ai = 34
            idx_aj = 35
            idx_al = 37
            idx_aq = 42
            idx_ar = 43
            idx_as = 44

            cols = [str(c) for c in raw.columns]
            emp_col = pick_col(cols, ["scg employee id", "scg_empid", "scg"])
            if not emp_col and len(raw.columns) >= 4:
                emp_col = raw.columns[3]
            if emp_col:
                raw = raw.copy()
                raw["SCG_EmpID"] = raw[emp_col].map(norm_text)
                raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
                raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

                def _cell(r: pd.Series, idx: int) -> str:
                    if idx < len(raw.columns):
                        return norm_text(r.iloc[idx])
                    return ""

                raw["Occupational Vision Exam"] = raw.apply(
                    lambda r: _build_eye_value(
                        _cell(r, idx_ad),  # index 1: distance vision
                        _cell(r, idx_ah),  # index 4: 3D vision
                        _cell(r, idx_ai),  # index 5: color test
                        _cell(r, idx_al),  # index 8: near vision
                        _cell(r, idx_aj),  # index 11: eye muscle balance
                        _cell(r, idx_aq),  # index 13: visual field
                        _cell(r, idx_ar),  # index 14: eye result
                        _cell(r, idx_as),  # index 15: recommendation
                    ),
                    axis=1,
                )
                mapped = raw[["SCG_EmpID", "Occupational Vision Exam"]]
                out = final_df.copy()
                out = out.drop(columns=["Occupational Vision Exam"], errors="ignore")
                out = out.merge(mapped, on="SCG_EmpID", how="left")
                out["Occupational Vision Exam"] = out["Occupational Vision Exam"].fillna("")
                return out[FINAL_COLUMNS]

    target_sheet: Optional[str] = None
    target_df: Optional[pd.DataFrame] = None
    best_score = -1
    for s in xls.sheet_names:
        try:
            probe = pd.read_excel(path, sheet_name=s)
        except Exception:
            continue
        cols = [str(c) for c in probe.columns]
        score = 0
        if pick_col(cols, ["SCG Employee ID"]):
            score += 2
        if pick_col(cols, ["การมองภาพระยะไกลด้วยสองตา", "distance", "far"]):
            score += 1
        if pick_col(cols, ["การมองภาพ3มิติ", "3มิติ", "3d"]):
            score += 1
        if pick_col(cols, ["การมองจำแนกสี", "แยกสี", "color"]):
            score += 1
        if pick_col(cols, ["การมองภาพระยะใกล้ด้วยสองตา", "near"]):
            score += 1
        if pick_col(cols, ["ลานสายตา", "visual field"]):
            score += 1
        if pick_col(cols, ["Eyes result", "ผลการตรวจสายตา", "สรุปสายตา"]):
            score += 2
        if score > best_score:
            best_score = score
            target_sheet = s
            target_df = probe

    if not target_sheet or target_df is None or best_score < 6:
        return final_df
    raw = target_df.copy()

    cols = [str(c) for c in raw.columns]
    emp_col = pick_col(cols, ["scg employee id", "scg_empid", "scg"])
    far_col = pick_col(cols, ["การมองภาพระยะไกลด้วยสองตา", "การมองด้วย2ตา", "far"])
    eye_3d_col = pick_col(cols, ["การมองภาพ3มิติ", "3มิติ", "3d"])
    color_col = pick_col(cols, ["การมองจำแนกสี", "แยกสี", "color"])
    near_col = pick_col(cols, ["การมองภาพระยะใกล้ด้วยสองตา", "near"])
    balance_v_col = pick_col(cols, ["ความสมดุลกล้ามเนื้อตาระยะใกล้แนวตั้ง", "balance"])
    balance_h_col = pick_col(cols, ["ความสมดุลกล้ามเนื้อตาระยะใกล้แนวนอน"])
    visual_field_col = pick_col(cols, ["ลานสายตา", "visual field"])
    eyes_result_col = pick_col(cols, ["eyes result", "ผลการตรวจสายตา", "สรุปสายตา"])
    # KK is currently treated as 7 eye fields; keep index 15 blank.
    eyes_sugg_col = pick_col(cols, ["eyes sugg", "คำแนะนำ"])
    if not emp_col or not eyes_result_col:
        return final_df

    raw = raw.copy()
    raw["SCG_EmpID"] = raw[emp_col].map(normalize_empid)
    raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
    raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

    def _balance_value(r: pd.Series) -> str:
        v = norm_text(r[balance_v_col]) if balance_v_col else ""
        h = norm_text(r[balance_h_col]) if balance_h_col else ""
        if v and h:
            return f"{v}/{h}"
        return v or h

    raw["Occupational Vision Exam"] = raw.apply(
        lambda r: _build_eye_value(
            r[far_col] if far_col else "",
            r[eye_3d_col] if eye_3d_col else "",
            r[color_col] if color_col else "",
            r[near_col] if near_col else "",
            _balance_value(r),
            r[visual_field_col] if visual_field_col else "",
            r[eyes_result_col],
            "",
        ),
        axis=1,
    )
    mapped = raw[["SCG_EmpID", "Occupational Vision Exam"]]

    out = final_df.copy()
    out = out.drop(columns=["Occupational Vision Exam"], errors="ignore")
    out = out.merge(mapped, on="SCG_EmpID", how="left")
    out["Occupational Vision Exam"] = out["Occupational Vision Exam"].fillna("")
    # Preserve final template column order
    out = out[FINAL_COLUMNS]
    return out


def _pair_value_result(value: object, result: object) -> str:
    v = norm_text(value)
    r = norm_text(result)
    if v and r:
        return f"{v},{r}"
    return v or r


def _blood_glucose_from_fbs(value: object) -> str:
    v = norm_text(value)
    if not v:
        return ""
    try:
        n = float(v)
    except Exception:
        return v
    if n >= 100:
        return f"{v},ระดับน้ำตาลในเลือดสูงกว่าปกติ"
    return f"{v},ระดับน้ำตาลในเลือดปกติ"


def map_additional_tests_from_raw(path: Path, final_df: pd.DataFrame) -> pd.DataFrame:
    year_match = re.search(r"(25\d{2})", path.name)
    year = year_match.group(1) if year_match else ""
    if year not in {"2564", "2565", "2566", "2567", "2568"}:
        return final_df

    xls = pd.ExcelFile(path)
    # KK 2564/2565/2566: fixed Sheet1/Sheet2 mapping
    if year in {"2564", "2565", "2566"} and ("Sheet2" in xls.sheet_names or "Sheet1" in xls.sheet_names):
        raw = pd.DataFrame()
        try:
            if "Sheet2" in xls.sheet_names:
                probe = pd.read_excel(path, sheet_name="Sheet2")
                if not probe.empty and len(probe.columns) >= 116:
                    raw = probe
            if raw.empty and "Sheet1" in xls.sheet_names:
                raw = pd.read_excel(path, sheet_name="Sheet1")
        except Exception:
            raw = pd.DataFrame()
        if raw.empty:
            return final_df

        raw = raw.copy()
        # 1-based -> 0-based
        idx_emp = 4
        idx_bp_result = 14
        idx_bmi = 18
        idx_bmi_result = 19
        idx_xray = 21
        idx_cbc = 33
        idx_urine_result = 44
        idx_fbs = 45
        idx_fbs_result = 46
        idx_bun = 51
        idx_bun_result = 52
        idx_cre = 53
        idx_cre_result = 54
        idx_sgot = 55
        idx_sgot_result = 56
        idx_sgpt = 57
        idx_sgpt_result = 58
        idx_ekg_result = 62
        idx_lung = 88
        idx_lead = 96
        idx_lead_result = 97
        idx_mercury = 98
        idx_mercury_result = 99
        idx_cadmium = 106
        idx_cadmium_result = 107
        idx_arsenic = 108
        idx_arsenic_result = 109
        idx_amphetamine = 114
        idx_amphetamine_result = 115

        def cell(r: pd.Series, idx: int) -> str:
            if idx < len(r):
                return norm_text(r.iloc[idx])
            return ""

        raw["SCG_EmpID"] = raw.iloc[:, idx_emp].map(normalize_empid)
        raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
        raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

        def blood_glucose(r: pd.Series) -> str:
            v = _blood_glucose_from_fbs(cell(r, idx_fbs))
            if v:
                return v
            return cell(r, idx_fbs_result)

        def kidney(r: pd.Series) -> str:
            bun = cell(r, idx_bun)
            cre = cell(r, idx_cre)
            bun_r = cell(r, idx_bun_result)
            cre_r = cell(r, idx_cre_result)
            if not any([bun, cre, bun_r, cre_r]):
                return ""
            if "ผิดปกติ" in bun_r or "ผิดปกติ" in cre_r:
                summary = "การทำงานของไตผิดปกติ"
            elif bun_r or cre_r:
                summary = "ปกติ"
            else:
                summary = ""
            return ",".join([bun, cre, summary])

        def liver(r: pd.Series) -> str:
            sgot = cell(r, idx_sgot)
            sgpt = cell(r, idx_sgpt)
            sgot_r = cell(r, idx_sgot_result)
            sgpt_r = cell(r, idx_sgpt_result)
            if not any([sgot, sgpt, sgot_r, sgpt_r]):
                return ""
            if "ผิดปกติ" in sgot_r or "ผิดปกติ" in sgpt_r:
                summary = "การทำงานของตับผิดปกติ"
            elif sgot_r or sgpt_r:
                summary = "ปกติ"
            else:
                summary = ""
            return ",".join([sgot, sgpt, "", summary])

        mapped = pd.DataFrame({
            "SCG_EmpID": raw["SCG_EmpID"],
            "Blood Pressure": raw.apply(lambda r: cell(r, idx_bp_result), axis=1),
            "Urinalysis": raw.apply(lambda r: cell(r, idx_urine_result), axis=1),
            "BMI": raw.apply(lambda r: _pair_value_result(cell(r, idx_bmi), cell(r, idx_bmi_result)), axis=1),
            "Blood Glucose": raw.apply(blood_glucose, axis=1),
            "Liver Function": raw.apply(liver, axis=1),
            "Kidney Function": raw.apply(kidney, axis=1),
            "Amphetamine": raw.apply(lambda r: _pair_value_result(cell(r, idx_amphetamine), cell(r, idx_amphetamine_result)), axis=1),
            "Blood Lead": raw.apply(lambda r: _pair_value_result(cell(r, idx_lead), cell(r, idx_lead_result)), axis=1),
            "Urine Mercury": raw.apply(lambda r: _pair_value_result(cell(r, idx_mercury), cell(r, idx_mercury_result)), axis=1),
            "Blood Cadmium": raw.apply(lambda r: _pair_value_result(cell(r, idx_cadmium), cell(r, idx_cadmium_result)), axis=1),
            "Urine Arsenic": raw.apply(lambda r: _pair_value_result(cell(r, idx_arsenic), cell(r, idx_arsenic_result)), axis=1),
            "CBC": raw.apply(lambda r: cell(r, idx_cbc), axis=1),
            "EKG": raw.apply(lambda r: cell(r, idx_ekg_result), axis=1),
            "Lung Function": raw.apply(lambda r: cell(r, idx_lung), axis=1),
            "Chest X-ray": raw.apply(lambda r: cell(r, idx_xray), axis=1),
        })

        out = final_df.copy()
        out = out.merge(mapped, on="SCG_EmpID", how="left", suffixes=("", "_new"))
        for col in mapped.columns:
            if col == "SCG_EmpID":
                continue
            new_col = f"{col}_new"
            if new_col in out.columns:
                out[col] = out[new_col].fillna(out[col] if col in out.columns else "")
                out = out.drop(columns=[new_col])
        return out[FINAL_COLUMNS]

    # KK 2567: use fixed Sheet2 column positions (stable in this workbook).
    if year == "2567" and "Sheet2" in xls.sheet_names:
        try:
            raw = pd.read_excel(path, sheet_name="Sheet2")
        except Exception:
            raw = pd.DataFrame()
        if raw.empty:
            return final_df

        raw = raw.copy()
        # 1-based -> 0-based indexes
        idx_emp = 4
        idx_bp_result = 14
        idx_bmi = 18
        idx_bmi_result = 19
        idx_xray = 21
        idx_cbc = 33
        idx_urine_result = 44
        idx_fbs = 45
        idx_bun = 51
        idx_bun_result = 52
        idx_cre = 53
        idx_cre_result = 54
        idx_sgot = 55
        idx_sgot_result = 56
        idx_sgpt = 57
        idx_sgpt_result = 58
        idx_ekg_result = 62
        idx_lung = 88
        idx_lead = 96
        idx_lead_result = 97
        idx_mercury = 98
        idx_mercury_result = 99
        idx_cadmium = 106
        idx_cadmium_result = 107
        idx_arsenic = 108
        idx_arsenic_result = 109
        idx_amphetamine = 114
        idx_amphetamine_result = 115

        def cell(r: pd.Series, idx: int) -> str:
            if idx < len(r):
                return norm_text(r.iloc[idx])
            return ""

        raw["SCG_EmpID"] = raw.iloc[:, idx_emp].map(normalize_empid)
        raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
        raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

        def bg(r: pd.Series) -> str:
            return _blood_glucose_from_fbs(cell(r, idx_fbs))

        def kidney(r: pd.Series) -> str:
            bun = cell(r, idx_bun)
            cre = cell(r, idx_cre)
            bun_r = cell(r, idx_bun_result)
            cre_r = cell(r, idx_cre_result)
            if not any([bun, cre, bun_r, cre_r]):
                return ""
            if "ผิดปกติ" in bun_r or "ผิดปกติ" in cre_r:
                summary = "การทำงานของไตผิดปกติ"
            elif bun_r or cre_r:
                summary = "ปกติ"
            else:
                summary = ""
            return ",".join([bun, cre, summary])

        def liver(r: pd.Series) -> str:
            sgot = cell(r, idx_sgot)
            sgpt = cell(r, idx_sgpt)
            sgot_r = cell(r, idx_sgot_result)
            sgpt_r = cell(r, idx_sgpt_result)
            if not any([sgot, sgpt, sgot_r, sgpt_r]):
                return ""
            if "ผิดปกติ" in sgot_r or "ผิดปกติ" in sgpt_r:
                summary = "การทำงานของตับผิดปกติ"
            elif sgot_r or sgpt_r:
                summary = "ปกติ"
            else:
                summary = ""
            return ",".join([sgot, sgpt, "", summary])

        mapped = pd.DataFrame({
            "SCG_EmpID": raw["SCG_EmpID"],
            "Blood Pressure": raw.apply(lambda r: cell(r, idx_bp_result), axis=1),
            "Urinalysis": raw.apply(lambda r: cell(r, idx_urine_result), axis=1),
            "BMI": raw.apply(lambda r: _pair_value_result(cell(r, idx_bmi), cell(r, idx_bmi_result)), axis=1),
            "Blood Glucose": raw.apply(bg, axis=1),
            "Liver Function": raw.apply(liver, axis=1),
            "Kidney Function": raw.apply(kidney, axis=1),
            "Amphetamine": raw.apply(lambda r: _pair_value_result(cell(r, idx_amphetamine), cell(r, idx_amphetamine_result)), axis=1),
            "Blood Lead": raw.apply(lambda r: _pair_value_result(cell(r, idx_lead), cell(r, idx_lead_result)), axis=1),
            "Urine Mercury": raw.apply(lambda r: _pair_value_result(cell(r, idx_mercury), cell(r, idx_mercury_result)), axis=1),
            "Blood Cadmium": raw.apply(lambda r: _pair_value_result(cell(r, idx_cadmium), cell(r, idx_cadmium_result)), axis=1),
            "Urine Arsenic": raw.apply(lambda r: _pair_value_result(cell(r, idx_arsenic), cell(r, idx_arsenic_result)), axis=1),
            "CBC": raw.apply(lambda r: cell(r, idx_cbc), axis=1),
            "EKG": raw.apply(lambda r: cell(r, idx_ekg_result), axis=1),
            "Lung Function": raw.apply(lambda r: cell(r, idx_lung), axis=1),
            "Chest X-ray": raw.apply(lambda r: cell(r, idx_xray), axis=1),
        })

        out = final_df.copy()
        out = out.merge(mapped, on="SCG_EmpID", how="left", suffixes=("", "_new"))
        for col in mapped.columns:
            if col == "SCG_EmpID":
                continue
            new_col = f"{col}_new"
            if new_col in out.columns:
                out[col] = out[new_col].fillna(out[col] if col in out.columns else "")
                out = out.drop(columns=[new_col])
        return out[FINAL_COLUMNS]

    if year == "2568":
        source_sheet = "68 Document for table"
    else:
        source_sheet = "Sheet2"
    if source_sheet not in xls.sheet_names:
        return final_df

    try:
        raw = pd.read_excel(path, sheet_name=source_sheet)
    except Exception:
        return final_df

    cols = [str(c) for c in raw.columns]
    emp_col = pick_col(cols, ["scg employee id", "scg_empid", "scg"])
    if not emp_col:
        return final_df

    def c(name_keys: list[str]) -> Optional[str]:
        return pick_col(cols, name_keys)

    col_bp_result = c(["BP Result", "Blooed presure result"])
    col_urine_result = c(["Urine result2", "Urine result"])
    col_bmi = c(["BMI"])
    col_bmi_result = c(["BMI Result"])
    col_lung = c(["Lung result", "Lung Result"])
    col_xray = c(["เอกซเรย์ทรวงอก", "Chest X-ray", "Lung x-ray result"])
    col_stool = c(["Stool Result"])
    col_va = c(["VA Rsult"])
    col_ekg = c(["ผลการตรวจคลื่นไฟฟ้าหัวใจ"])
    col_cbc = c(["ความสมบูรณ์ของเม็ดเลือด&อัตราส่วนเม็ดเลือดขาว"])

    col_bun = c(["BUN", "BUN("])
    col_bun_result = c(["Bun Result"])
    col_cre = c(["Creatinine", "Crea("])
    col_cre_result = c(["Creatinine Result"])
    col_kidney_result = c(["Kidney result"])

    col_sgot = c(["SGOT"])
    col_sgot_result = c(["SGOT Result"])
    col_sgpt = c(["SGPT"])
    col_sgpt_result = c(["SGPT Result"])
    col_alkp = c(["ALKP"])
    col_liver_result = c(["การทำงานของตับ : LIVER FUNCTION"])

    col_uric = c(["Uric"])
    col_uric_result = c(["Uric Acid result"])

    col_psa = c(["PSA"])
    col_psa_result = c(["PSA result"])
    col_amphetamine = c(["Amphetamine", "Methamphetamine Result", "Methamphetamine"])

    col_lead = c(["(Lead)", "Lead in Blood"])
    col_lead_result = c(["Lead result"])
    col_acetone = c(["(Acetone)"])
    col_acetone_result = c(["Acetone result"])
    col_mercury = c(["(Mercury)", "Mercury in Urine"])
    col_mercury_result = c(["Mercury result"])
    col_toluene = c(["(Toluene)"])
    col_toluene_result = c(["Toluene result"])
    col_cadmium = c(["(Cadmium)", "Cadmium in Blood"])
    col_cadmium_result = c(["Cadmium result", "Blood Cadmium Result"])
    col_xylene = c(["(Xylene)"])
    col_xylene_result = c(["Xylene result"])
    col_methyl = c(["(Methyl)"])
    col_methyl_result = c(["Methyl result"])
    col_phenol = c(["(Phenol)"])
    col_phenol_result = c(["Phenol result"])
    col_arsenic = c(["Arsenic", "Arsenic in urine"])
    col_arsenic_result = c(["Arsenic result", "Urine Arsenic Result"])
    col_fbs = c(["FBS", "ตรวจน้ำตาลในเลือด(FBS)"])
    col_ekg_result = c(["EKG Result2", "EKG Result"])

    raw = raw.copy()
    raw["SCG_EmpID"] = raw[emp_col].map(norm_text)
    raw = raw[raw["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
    raw = raw.drop_duplicates(subset=["SCG_EmpID"], keep="first")

    def g(r: pd.Series, col: Optional[str]) -> str:
        if not col:
            return ""
        return norm_text(r[col])

    def liver_value(r: pd.Series) -> str:
        a = g(r, col_sgot)
        b = g(r, col_sgpt)
        c_ = g(r, col_alkp)
        summary = g(r, col_liver_result)
        if not summary and year == "2567":
            sgot_r = g(r, col_sgot_result)
            sgpt_r = g(r, col_sgpt_result)
            if "ผิดปกติ" in sgot_r or "ผิดปกติ" in sgpt_r:
                summary = "การทำงานของตับผิดปกติ"
            elif sgot_r or sgpt_r:
                summary = "ปกติ"
        if not any([a, b, c_, summary]):
            return ""
        return ",".join([a, b, c_, summary])

    def kidney_value(r: pd.Series) -> str:
        bun = g(r, col_bun)
        cre = g(r, col_cre)
        summary = g(r, col_kidney_result)
        if not summary and year == "2567":
            bun_r = g(r, col_bun_result)
            cre_r = g(r, col_cre_result)
            if "ผิดปกติ" in bun_r or "ผิดปกติ" in cre_r:
                summary = "การทำงานของไตผิดปกติ"
            elif bun_r or cre_r:
                summary = "ปกติ"
        if not any([bun, cre, summary]):
            return ""
        return ",".join([bun, cre, summary])

    mapped = pd.DataFrame({
        "SCG_EmpID": raw["SCG_EmpID"],
        "Blood Pressure": raw.apply(lambda r: g(r, col_bp_result), axis=1),
        "Urinalysis": raw.apply(lambda r: g(r, col_urine_result), axis=1),
        "BMI": raw.apply(lambda r: _pair_value_result(g(r, col_bmi), g(r, col_bmi_result)), axis=1),
        "Blood Glucose": raw.apply(lambda r: _blood_glucose_from_fbs(g(r, col_fbs)), axis=1),
        "Lung Function": raw.apply(lambda r: g(r, col_lung), axis=1),
        "Chest X-ray": raw.apply(lambda r: g(r, col_xray), axis=1),
        "Stool Exam": raw.apply(lambda r: g(r, col_stool), axis=1),
        "VA": raw.apply(lambda r: g(r, col_va), axis=1),
        "EKG": raw.apply(lambda r: g(r, col_ekg_result) or g(r, col_ekg), axis=1),
        "CBC": raw.apply(lambda r: g(r, col_cbc), axis=1),
        "Kidney Function": raw.apply(kidney_value, axis=1),
        "Liver Function": raw.apply(liver_value, axis=1),
        "Uric Acid": raw.apply(lambda r: _pair_value_result(g(r, col_uric), g(r, col_uric_result)), axis=1),
        "PSA (Prostate Specific Antigen)": raw.apply(lambda r: _pair_value_result(g(r, col_psa), g(r, col_psa_result)), axis=1),
        "Amphetamine": raw.apply(lambda r: g(r, col_amphetamine), axis=1),
        "Blood Lead": raw.apply(lambda r: _pair_value_result(g(r, col_lead), g(r, col_lead_result)), axis=1),
        "Urine Acetone": raw.apply(lambda r: _pair_value_result(g(r, col_acetone), g(r, col_acetone_result)), axis=1),
        "Urine Mercury": raw.apply(lambda r: _pair_value_result(g(r, col_mercury), g(r, col_mercury_result)), axis=1),
        "Urine Toluene": raw.apply(lambda r: _pair_value_result(g(r, col_toluene), g(r, col_toluene_result)), axis=1),
        "Blood Cadmium": raw.apply(lambda r: _pair_value_result(g(r, col_cadmium), g(r, col_cadmium_result)), axis=1),
        "Urine Xylene": raw.apply(lambda r: _pair_value_result(g(r, col_xylene), g(r, col_xylene_result)), axis=1),
        "Urine Methyl Ethyl Ketone": raw.apply(lambda r: _pair_value_result(g(r, col_methyl), g(r, col_methyl_result)), axis=1),
        "Urine Phenol": raw.apply(lambda r: _pair_value_result(g(r, col_phenol), g(r, col_phenol_result)), axis=1),
        "Urine Arsenic": raw.apply(lambda r: _pair_value_result(g(r, col_arsenic), g(r, col_arsenic_result)), axis=1),
    })

    out = final_df.copy()
    out = out.merge(mapped, on="SCG_EmpID", how="left", suffixes=("", "_new"))
    for col in mapped.columns:
        if col == "SCG_EmpID":
            continue
        new_col = f"{col}_new"
        if new_col in out.columns:
            out[col] = out[new_col].fillna(out[col] if col in out.columns else "")
            out = out.drop(columns=[new_col])
    return out[FINAL_COLUMNS]


def map_hearing_17_all_years(path: Path, final_df: pd.DataFrame) -> pd.DataFrame:
    # Keep 17-slot hearing format across KK years:
    # 0..6 right frequencies, 7..13 left frequencies, 14 right result, 15 left result, 16 suggestion.
    xls = pd.ExcelFile(path)
    year_match = re.search(r"(25\d{2})", path.name)
    year = year_match.group(1) if year_match else ""

    def num_or_text(v: object) -> str:
        t = norm_text(v)
        if not t:
            return ""
        try:
            n = float(t)
            if n.is_integer():
                return str(int(n))
            return str(round(n, 2))
        except Exception:
            return t

    def classify_avg(nums: list[str]) -> str:
        vals: list[float] = []
        for x in nums:
            if not x:
                continue
            try:
                vals.append(float(x))
            except Exception:
                continue
        if not vals:
            return ""
        avg = sum(vals) / len(vals)
        return "ผิดปกติ" if avg > 25 else "ปกติ"

    # Special-case KK 2568 hearing layout (DU..EN style columns).
    if year == "2568":
        if "68 Document for table" in xls.sheet_names:
            try:
                df = pd.read_excel(path, sheet_name="68 Document for table")
            except Exception:
                df = pd.DataFrame()
            if not df.empty:
                cols = [str(c) for c in df.columns]
                emp_col = pick_col(cols, ["scg employee id", "รหัสพนักงาน", "รหัส", "scg"])
                if emp_col:
                    r500 = pick_col(cols, ["500R"])
                    r1k = pick_col(cols, ["1kR"])
                    r2k = pick_col(cols, ["2kR"])
                    r3k = pick_col(cols, ["3kR"])
                    r4k = pick_col(cols, ["4kR"])
                    r6k = pick_col(cols, ["6kR"])
                    r8k = pick_col(cols, ["8kR"])
                    l500 = pick_col(cols, ["500L"])
                    l1k = pick_col(cols, ["1kL"])
                    l2k = pick_col(cols, ["2kL"])
                    l3k = pick_col(cols, ["3kL"])
                    l4k = pick_col(cols, ["4kL"])
                    l6k = pick_col(cols, ["6kL"])
                    l8k = pick_col(cols, ["8kL"])
                    summary_col = pick_col(cols, ["สรุปหู"])
                    sugg_col = pick_col(cols, ["แนะนำหู"])

                    d = df.copy()
                    d["SCG_EmpID"] = d[emp_col].map(normalize_empid)
                    d = d[d["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
                    d = d.drop_duplicates(subset=["SCG_EmpID"], keep="first")

                    def g(r: pd.Series, c: Optional[str]) -> str:
                        if not c:
                            return ""
                        return num_or_text(r[c]).replace(",", "-")

                    def build_hearing(r: pd.Series) -> str:
                        parts = [""] * 17
                        parts[0] = g(r, r500)
                        parts[1] = g(r, r1k)
                        parts[2] = g(r, r2k)
                        parts[3] = g(r, r3k)
                        parts[4] = g(r, r4k)
                        parts[5] = g(r, r6k)
                        parts[6] = g(r, r8k)
                        parts[7] = g(r, l500)
                        parts[8] = g(r, l1k)
                        parts[9] = g(r, l2k)
                        parts[10] = g(r, l3k)
                        parts[11] = g(r, l4k)
                        parts[12] = g(r, l6k)
                        parts[13] = g(r, l8k)
                        parts[14] = classify_avg(parts[0:7])
                        parts[15] = classify_avg(parts[7:14])
                        sugg = g(r, sugg_col)
                        if not sugg:
                            sugg = g(r, summary_col)
                        parts[16] = sugg
                        if not any(parts):
                            return ""
                        return ",".join(parts)

                    d["Hearing Test"] = d.apply(build_hearing, axis=1)
                    best_df = d[["SCG_EmpID", "Hearing Test"]]
                    if not best_df.empty:
                        out = final_df.copy()
                        out = out.drop(columns=["Hearing Test"], errors="ignore")
                        out = out.merge(best_df, on="SCG_EmpID", how="left")
                        out["Hearing Test"] = out["Hearing Test"].fillna("")
                        return out[FINAL_COLUMNS]

    # Special-case KK 2566 hearing layout by fixed BL..CD positions.
    # Ignore average columns BP, BT, BY, CC as requested.
    if year == "2566":
        for s in xls.sheet_names:
            try:
                df = pd.read_excel(path, sheet_name=s)
            except Exception:
                continue
            if len(df.columns) < 82:
                continue

            # 1-based to 0-based
            idx_emp = 4  # รหัส
            idx_r500 = 63   # BL
            idx_r1k = 64    # BM
            idx_r2k = 65    # BN
            idx_r3k = 66    # BO
            # BP ignored
            idx_r4k = 68    # BQ
            idx_r6k = 69    # BR
            idx_r8k = 70    # BS
            # BT ignored
            idx_l500 = 72   # BU
            idx_l1k = 73    # BV
            idx_l2k = 74    # BW
            idx_l3k = 75    # BX
            # BY ignored
            idx_l4k = 77    # BZ
            idx_l6k = 78    # CA
            idx_l8k = 79    # CB
            # CC ignored (avg)
            idx_summary = 81  # CD

            d = df.copy()
            d["SCG_EmpID"] = d.iloc[:, idx_emp].map(normalize_empid)
            d = d[d["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
            d = d.drop_duplicates(subset=["SCG_EmpID"], keep="first")

            def cell(r: pd.Series, idx: int) -> str:
                if idx < len(r):
                    return num_or_text(r.iloc[idx]).replace(",", "-")
                return ""

            def build_hearing(r: pd.Series) -> str:
                parts = [""] * 17
                parts[0] = cell(r, idx_r500)
                parts[1] = cell(r, idx_r1k)
                parts[2] = cell(r, idx_r2k)
                parts[3] = cell(r, idx_r3k)
                parts[4] = cell(r, idx_r4k)
                parts[5] = cell(r, idx_r6k)
                parts[6] = cell(r, idx_r8k)
                parts[7] = cell(r, idx_l500)
                parts[8] = cell(r, idx_l1k)
                parts[9] = cell(r, idx_l2k)
                parts[10] = cell(r, idx_l3k)
                parts[11] = cell(r, idx_l4k)
                parts[12] = cell(r, idx_l6k)
                parts[13] = cell(r, idx_l8k)
                parts[14] = classify_avg(parts[0:7])
                parts[15] = classify_avg(parts[7:14])
                parts[16] = cell(r, idx_summary)
                if not any(parts):
                    return ""
                return ",".join(parts)

            d["Hearing Test"] = d.apply(build_hearing, axis=1)
            hearing_non_empty = int((d["Hearing Test"].fillna("").astype(str).str.strip() != "").sum())
            if hearing_non_empty > 0:
                out = final_df.copy()
                out = out.drop(columns=["Hearing Test"], errors="ignore")
                out = out.merge(d[["SCG_EmpID", "Hearing Test"]], on="SCG_EmpID", how="left")
                out["Hearing Test"] = out["Hearing Test"].fillna("")
                return out[FINAL_COLUMNS]

    # Special-case KK 2564-2567 hearing layout (BL..CD style columns).
    if year in {"2564", "2565", "2566", "2567"}:
        best_df: Optional[pd.DataFrame] = None
        best_count = -1
        for s in xls.sheet_names:
            try:
                df = pd.read_excel(path, sheet_name=s)
            except Exception:
                continue
            cols = [str(c) for c in df.columns]
            if not any("500 ขวา" in c for c in cols):
                continue

            emp_col = pick_col(cols, ["scg employee id", "รหัสพนักงาน", "รหัส", "scg"])
            if not emp_col:
                continue

            r500 = pick_col(cols, ["500 ขวา"])
            r1k = pick_col(cols, ["1k ขวา"])
            r2k = pick_col(cols, ["2k ขวา"])
            r3k = pick_col(cols, ["3k ขวา"])
            r4k = pick_col(cols, ["4k ขวา"])
            r6k = pick_col(cols, ["6k ขวา"])
            r8k = pick_col(cols, ["8k ขวา"])
            l500 = pick_col(cols, ["500 ซ้าย"])
            l1k = pick_col(cols, ["1k ซ้าย"])
            l2k = pick_col(cols, ["2k ซ้าย"])
            l3k = pick_col(cols, ["3k ซ้าย"])
            l4k = pick_col(cols, ["4k ซ้าย"])
            l6k = pick_col(cols, ["6k ซ้าย"])
            l8k = pick_col(cols, ["8k ซ้าย"])
            summary_col = pick_col(cols, ["สรุปผลตรวจ"])

            d = df.copy()
            d["SCG_EmpID"] = d[emp_col].map(normalize_empid)
            d = d[d["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
            d = d.drop_duplicates(subset=["SCG_EmpID"], keep="first")

            def g(r: pd.Series, c: Optional[str]) -> str:
                if not c:
                    return ""
                return num_or_text(r[c]).replace(",", "-")

            def build_hearing(r: pd.Series) -> str:
                parts = [""] * 17
                parts[0] = g(r, r500)
                parts[1] = g(r, r1k)
                parts[2] = g(r, r2k)
                parts[3] = g(r, r3k)
                parts[4] = g(r, r4k)
                parts[5] = g(r, r6k)
                parts[6] = g(r, r8k)
                parts[7] = g(r, l500)
                parts[8] = g(r, l1k)
                parts[9] = g(r, l2k)
                parts[10] = g(r, l3k)
                parts[11] = g(r, l4k)
                parts[12] = g(r, l6k)
                parts[13] = g(r, l8k)
                parts[14] = classify_avg(parts[0:7])
                parts[15] = classify_avg(parts[7:14])
                parts[16] = g(r, summary_col)
                if not any(parts):
                    return ""
                return ",".join(parts)

            d["Hearing Test"] = d.apply(build_hearing, axis=1)
            count = int((d["Hearing Test"].str.strip() != "").sum())
            if count > best_count:
                best_df = d[["SCG_EmpID", "Hearing Test"]]
                best_count = count

        if best_df is not None and best_count > 0:
            out = final_df.copy()
            out = out.drop(columns=["Hearing Test"], errors="ignore")
            out = out.merge(best_df, on="SCG_EmpID", how="left")
            out["Hearing Test"] = out["Hearing Test"].fillna("")
            return out[FINAL_COLUMNS]

    best: Optional[pd.DataFrame] = None
    best_count = -1

    for s in xls.sheet_names:
        try:
            df = pd.read_excel(path, sheet_name=s)
        except Exception:
            continue
        cols = [str(c) for c in df.columns]
        emp_col = pick_col(cols, ["scg employee id", "รหัสพนักงาน", "รหัส", "scg"])
        if not emp_col:
            continue

        # Detailed frequency columns if present
        r500 = pick_col(cols, ["R500"])
        r1k = pick_col(cols, ["R1k"])
        r2k = pick_col(cols, ["R2k"])
        r3k = pick_col(cols, ["R3k"])
        r4k = pick_col(cols, ["R4k"])
        r6k = pick_col(cols, ["R6k"])
        r8k = pick_col(cols, ["R8k"])
        l500 = pick_col(cols, ["L500"])
        l1k = pick_col(cols, ["L1k"])
        l2k = pick_col(cols, ["L2k"])
        l3k = pick_col(cols, ["L3k"])
        l4k = pick_col(cols, ["L4k"])
        l6k = pick_col(cols, ["L6k"])
        l8k = pick_col(cols, ["L8k"])

        right_result_col = pick_col(cols, ["Result right ear"])
        left_result_col = pick_col(cols, ["Result left ear"])
        ear_sugg_col = pick_col(cols, ["Ear sugg"])
        ear_summary_col = pick_col(cols, ["EArs Result", "Ears Result", "Ear Result", "Hearing result"])

        d = df.copy()
        d["SCG_EmpID"] = d[emp_col].map(normalize_empid)
        d = d[d["SCG_EmpID"].str.match(EMPID_PATTERN, na=False)]
        d = d.drop_duplicates(subset=["SCG_EmpID"], keep="first")

        def g(r: pd.Series, c: Optional[str]) -> str:
            if not c:
                return ""
            return num_or_text(r[c]).replace(",", "-")

        def build_hearing(r: pd.Series) -> str:
            parts = [""] * 17
            # Right 7
            parts[0] = g(r, r500)
            parts[1] = g(r, r1k)
            parts[2] = g(r, r2k)
            parts[3] = g(r, r3k)
            parts[4] = g(r, r4k)
            parts[5] = g(r, r6k)
            parts[6] = g(r, r8k)
            # Left 7
            parts[7] = g(r, l500)
            parts[8] = g(r, l1k)
            parts[9] = g(r, l2k)
            parts[10] = g(r, l3k)
            parts[11] = g(r, l4k)
            parts[12] = g(r, l6k)
            parts[13] = g(r, l8k)

            # Results
            right_result = g(r, right_result_col)
            left_result = g(r, left_result_col)
            if not right_result:
                right_result = classify_avg(parts[0:7])
            if not left_result:
                left_result = classify_avg(parts[7:14])
            parts[14] = right_result
            parts[15] = left_result

            sugg = g(r, ear_sugg_col)
            if not sugg:
                sugg = g(r, ear_summary_col)
            parts[16] = sugg

            # If no signal at all, return blank
            if not any(parts):
                return ""
            return ",".join(parts)

        d["Hearing Test"] = d.apply(build_hearing, axis=1)

        count = int((d["Hearing Test"].str.strip() != "").sum())
        if count > best_count:
            best = d[["SCG_EmpID", "Hearing Test"]]
            best_count = count

    if best is None or best_count <= 0:
        return final_df

    out = final_df.copy()
    out = out.drop(columns=["Hearing Test"], errors="ignore")
    out = out.merge(best, on="SCG_EmpID", how="left")
    out["Hearing Test"] = out["Hearing Test"].fillna("")
    return out[FINAL_COLUMNS]


def main() -> None:
    FINAL_DIR.mkdir(parents=True, exist_ok=True)
    files = [f for f in sorted(RAW_DIR.glob("*.xlsx")) if not f.name.startswith("~$")]
    if not files:
        raise FileNotFoundError(f"No KK raw files found in: {RAW_DIR}")

    for path in files:
        year_match = re.search(r"(25\d{2})", path.name)
        if not year_match:
            print(f"[SKIP] No year in filename: {path.name}")
            continue
        year = year_match.group(1)
        people = extract_people_kk(path)
        final_df = to_final_template(people)
        final_df = map_occupational_vision_from_raw(path, final_df)
        final_df = map_hearing_17_all_years(path, final_df)
        final_df = map_additional_tests_from_raw(path, final_df)
        out_path = FINAL_DIR / f"KK_FINAL_{year}.xlsx"
        final_df.to_excel(out_path, index=False)
        print(f"[OK] {path.name} -> {out_path.name} ({len(final_df)} rows)")


if __name__ == "__main__":
    main()
