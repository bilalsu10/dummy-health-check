import pandas as pd
import re

from helpers import ensure_sheet, norm_hn, read_sheet_data_block


def _norm_col(s: str) -> str:
    return re.sub(r"\s+", "", str(s)).lower()


def _pick_col(cols, options):
    norm_cols = [(_norm_col(c), c) for c in cols]
    norm_opts = [_norm_col(o) for o in options]
    for opt in norm_opts:
        for norm, raw in norm_cols:
            if opt and opt in norm:
                return raw
    return None


def _normalize_name(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).strip())


def _looks_like_sequential_hn(series: pd.Series) -> bool:
    nums = series.dropna().astype(str).str.strip().head(50)
    parsed = nums.apply(lambda v: int(float(v)) if v.replace(".", "", 1).isdigit() else None)
    parsed = parsed.dropna()
    if parsed.empty:
        return False
    # If most values are small consecutive ints, treat as row numbers, not real HN.
    return parsed.nunique() >= 10 and parsed.max() <= 1000


def _find_hn_source_sheet(path: str, xls: pd.ExcelFile, skip_sheet: str):
    for candidate in xls.sheet_names:
        if candidate == skip_sheet:
            continue
        try:
            probe = read_sheet_data_block(path, candidate, allow_no_lamdup=True)
        except Exception:
            continue
        cols = [str(c).replace("\ufeff", "").strip() for c in probe.columns]
        hn_col = _pick_col(cols, ["HN", "H.N."])
        name_col = _pick_col(cols, ["ชื่อ -  สกุล", "ชื่อ - สกุล", "ชื่อ-สกุล", "Name"])
        if not hn_col or not name_col:
            continue
        hn_vals = probe[hn_col].astype(str).str.strip()
        # Prefer sheets where HN looks like 12345-67
        if hn_vals.str.contains(r"\d+-\d+", regex=True, na=False).mean() >= 0.5:
            return probe[[hn_col, name_col]].rename(columns={hn_col: "HN", name_col: "Name"})
    return None


def _build_people_from_bill(path: str) -> pd.DataFrame:
    grid = pd.read_excel(path, sheet_name="Bill", header=None)
    header_idx = None
    key_tokens = [
        "BMI",
        "Systolic",
        "Diastolic",
        "ความดัน",
        "รหัส",
        "ชื่อ",
        "ตำแหน่ง",
        "แผนก",
        "ฝ่าย",
        "ส่วน",
        "Department",
        "Division",
    ]
    for i in range(min(40, len(grid))):
        row = [str(v).strip() for v in grid.iloc[i].tolist()]
        joined = " | ".join(row)
        if any(tok in joined for tok in key_tokens):
            if "BMI" in joined or "ความดัน" in joined or "Systolic" in joined:
                header_idx = i
                break
    if header_idx is None:
        raise ValueError("Bill: header row not found.")

    header_row = [str(v).strip() for v in grid.iloc[header_idx].tolist()]
    next_row = [str(v).strip() for v in grid.iloc[header_idx + 1].tolist()] if header_idx + 1 < len(grid) else []
    # Merge header with next row when header is empty.
    if next_row:
        merged = []
        for h, n in zip(header_row, next_row):
            if h in ("", "nan", "NaN"):
                merged.append(n)
            else:
                merged.append(h)
        header_row = merged
    has_subheader = any("Systolic" in v or "Diastolic" in v for v in next_row)
    data_start = header_idx + 2 if has_subheader else header_idx + 1

    df = grid.iloc[data_start:].copy()
    df.columns = header_row
    df = df.dropna(how="all").reset_index(drop=True)

    cols = list(df.columns)
    emp_col = _pick_col(cols, ["SCG EmpID", "SCG_EmpID", "Employee ID", "EmpID", "รหัสพนักงาน", "รหัส"])
    name_col = _pick_col(cols, ["ชื่อ - นามสกุล", "ชื่อ-นามสกุล", "ชื่อ-สกุล", "ชื่อ - สกุล", "ชื่อ", "Name"])
    sex_col = _pick_col(cols, ["เพศ", "Sex", "Gender"])
    pos_col = _pick_col(cols, ["ตำแหน่ง", "ต่ำแหน่ง", "Position"])
    dept_col = _pick_col(cols, ["แผนก", "Department"])
    sec_col = _pick_col(cols, ["ส่วน", "Section"])
    div_col = _pick_col(cols, ["ฝ่าย", "Division"])

    if emp_col is None or name_col is None:
        raise ValueError("Bill: cannot find employee id or name columns.")

    people = pd.DataFrame({
        "RowNo": range(1, len(df) + 1),
        "HN": df[emp_col].apply(norm_hn),
        "SCG_EmpID": df[emp_col].astype(str).str.strip(),
        "Name": df[name_col].astype(str).str.strip(),
        "DOB": "",
        "Age": df[_pick_col(cols, ["อายุ", "Age"])] if _pick_col(cols, ["อายุ", "Age"]) else "",
        "Position": df[pos_col].astype(str).str.strip() if pos_col else "",
        "Section": "",
        "Department": df[dept_col].astype(str).str.strip() if dept_col else "",
        "Division": "",
        "Sex": df[sex_col].astype(str).str.strip() if sex_col else "",
    })
    people = people.drop_duplicates(subset=["HN"], keep="first")
    return people


def _fill_org_from_other_sheets(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    org_cols = ["Position", "Section", "Department", "Division"]
    for candidate in xls.sheet_names:
        try:
            probe = read_sheet_data_block(path, candidate, allow_no_lamdup=True)
        except Exception:
            continue
        cols = [str(c).replace("\ufeff", "").strip() for c in probe.columns]
        if "HN" not in cols:
            hn_col = _pick_col(cols, ["HN", "H.N."])
            if hn_col is None:
                continue
            probe = probe.rename(columns={hn_col: "HN"})
        if not any(c in cols for c in org_cols + ["ตำแหน่ง", "ส่วน", "หน่วยงาน/ผู้จัดการ", "ฝ่าย"]):
            continue

        org_map = {}
        for src, dst in [
            ("Position", "Position"),
            ("ตำแหน่ง", "Position"),
            ("Section", "Section"),
            ("ส่วน", "Section"),
            ("Department", "Department"),
            ("หน่วยงาน/ผู้จัดการ", "Department"),
            ("หน่วยงาน", "Department"),
            ("Division", "Division"),
            ("ฝ่าย", "Division"),
        ]:
            if src in probe.columns:
                org_map[src] = dst
        if not org_map:
            continue

        temp = probe.rename(columns=org_map)[["HN"] + list(set(org_map.values()))]
        temp["HN"] = temp["HN"].apply(norm_hn)
        people = people.merge(temp, on="HN", how="left", suffixes=("", "_tmp"))
        for col in org_cols:
            tmp = f"{col}_tmp"
            if tmp in people.columns:
                people[col] = people[col].where(people[col].ne(""), people[tmp].fillna(""))
                people = people.drop(columns=[tmp])

        if all(col in people.columns and people[col].ne("").any() for col in org_cols):
            break

    return people


def _fill_empid_from_data_sheet(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    if "data" not in xls.sheet_names:
        return people

    grid = pd.read_excel(path, sheet_name="data", header=None)
    header_row = None
    hn_col_idx = None
    for i in range(min(10, len(grid))):
        row = grid.iloc[i].astype(str).fillna("")
        for j, v in enumerate(row):
            if v.strip() == "HN":
                header_row = i
                hn_col_idx = j
                break
        if hn_col_idx is not None:
            break
    if hn_col_idx is None:
        return people

    data_rows = grid.iloc[header_row + 1 :].copy()

    empid_idx = None
    best_count = 0
    empid_pattern = re.compile(r"^\d{4}-\d{6}$")
    for col_idx in range(data_rows.shape[1]):
        series = data_rows.iloc[:, col_idx].astype(str).str.strip()
        count = series.apply(lambda v: bool(empid_pattern.match(v))).sum()
        if count > best_count:
            best_count = count
            empid_idx = col_idx

    if empid_idx is None or best_count == 0:
        return people

    map_df = pd.DataFrame({
        "HN": data_rows.iloc[:, hn_col_idx].apply(norm_hn),
        "SCG_EmpID": data_rows.iloc[:, empid_idx].astype(str).str.strip(),
    })
    map_df = map_df[map_df["HN"].notna()].drop_duplicates(subset=["HN"], keep="first")

    people = people.merge(map_df, on="HN", how="left", suffixes=("", "_map"))
    people["SCG_EmpID"] = people["SCG_EmpID"].where(
        people["SCG_EmpID"].astype(str).str.strip().ne(""),
        people["SCG_EmpID_map"].fillna(""),
    )
    people = people.drop(columns=["SCG_EmpID_map"])
    return people


# =========================
# People master (???????) ? Source of truth for identity + org
# =========================

def load_people_master(path: str, xls: pd.ExcelFile) -> pd.DataFrame:
    sheet_name = "รายชื่อ"
    if sheet_name not in xls.sheet_names:
        # Prefer Bill sheet if available (TL files).
        if "Bill" in xls.sheet_names:
            try:
                return _build_people_from_bill(path)
            except Exception:
                pass
        # Otherwise, look for a sheet that clearly has HN + Name.
        preferred = None
        for candidate in xls.sheet_names:
            if candidate == "Bill":
                continue
            try:
                probe = read_sheet_data_block(path, candidate, allow_no_lamdup=True)
            except Exception:
                continue
            cols = [str(c).replace("\ufeff", "").strip() for c in probe.columns]
            has_hn = any(c == "HN" or "HN" in c for c in cols)
            has_name = any("ชื่อ" in c or "Name" in c for c in cols)
            if has_hn and has_name:
                preferred = candidate
                break
        if preferred:
            sheet_name = preferred
        else:
            # Fallback: first sheet containing HN
            for candidate in xls.sheet_names:
                try:
                    probe = read_sheet_data_block(path, candidate, allow_no_lamdup=True)
                except Exception:
                    continue
                cols = [str(c).replace("\ufeff", "").strip() for c in probe.columns]
                if any(c == "HN" or "HN" in c for c in cols):
                    sheet_name = candidate
                    break
            else:
                raise ValueError(f"Cannot find people master sheet in {path}.")
    else:
        ensure_sheet(xls, sheet_name)

    people = read_sheet_data_block(path, sheet_name, allow_no_lamdup=True)
    people["RowNo"] = range(1, len(people) + 1)
    people.columns = [str(c).replace("\ufeff", "").strip() for c in people.columns]

    cols = list(people.columns)
    hn_src = _pick_col(cols, ["HN"])
    name_src = _pick_col(cols, ["ชื่อ - สกุล", "ชื่อ-สกุล", "Name"])
    dob_src = _pick_col(cols, ["ว/ด/ป", "DOB"])
    age_src = _pick_col(cols, ["อายุ", "Age"])
    emp_src = _pick_col(cols, ["SCG Employee ID", "SCG_EmpID", "รหัสพนักงาน", "รหัส"])
    sex_src = _pick_col(cols, ["เพศ", "Sex", "Gender"])
    pos_src = _pick_col(cols, ["Position", "ตำแหน่ง"])
    sec_src = _pick_col(cols, ["Section", "ส่วน"])
    dept_src = _pick_col(cols, ["Department", "หน่วยงาน/ผู้จัดการ", "หน่วยงาน", "แผนก"])
    div_src = _pick_col(cols, ["Division", "ฝ่าย"])

    rename_map = {k: v for k, v in [
        (hn_src, "HN"),
        (name_src, "Name"),
        (dob_src, "DOB"),
        (age_src, "Age"),
        (emp_src, "SCG_EmpID"),
        (sex_src, "Sex"),
        (pos_src, "Position"),
        (sec_src, "Section"),
        (dept_src, "Department"),
        (div_src, "Division"),
    ] if k}

    people = people.rename(columns=rename_map)

    if "HN" not in people.columns:
        hn_candidates = [c for c in people.columns if "HN" in c]
        if hn_candidates:
            people = people.rename(columns={hn_candidates[0]: "HN"})
        else:
            raise ValueError("รายชื่อ: Cannot find HN column.")

    people["HN"] = people["HN"].apply(norm_hn)
    people = people.drop_duplicates(subset=["HN"], keep="first")

    # If HN looks like sequential row numbers, try to recover HN from another sheet
    # (e.g., hearing sheet that contains real HN values).
    if _looks_like_sequential_hn(people["HN"]):
        hn_source = _find_hn_source_sheet(path, xls, sheet_name)
        if hn_source is not None and "Name" in people.columns:
            name_to_hn = {
                _normalize_name(n): h
                for h, n in zip(hn_source["HN"], hn_source["Name"])
                if pd.notna(h) and pd.notna(n)
            }
            mapped = people["Name"].apply(lambda n: name_to_hn.get(_normalize_name(n)))
            people["HN"] = people["HN"].where(mapped.isna(), mapped)
            people["HN"] = people["HN"].apply(norm_hn)
            people = people.drop_duplicates(subset=["HN"], keep="first")

    for col in ["SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "Sex"]:
        if col not in people.columns:
            people[col] = ""

    people = _fill_org_from_other_sheets(path, xls, people)
    people = _fill_empid_from_data_sheet(path, xls, people)

    required = [
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
    ]
    for c in required:
        if c not in people.columns:
            people[c] = ""

    return people[required]
