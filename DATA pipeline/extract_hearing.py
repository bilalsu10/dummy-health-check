import pandas as pd

from helpers import (
    cell_to_str,
    resolve_sheet,
    fixed_concat_by_cols,
    fixed_concat_by_indices,
    norm_hn,
    pick_col_contains_any,
    read_hearing_grid_block,
    read_sheet_data_block,
)


RIGHT_FREQS = ["500", "1000", "2000", "3000", "4000", "6000", "8000"]
LEFT_FREQS = ["500 (2)", "1000 (2)", "2000 (2)", "3000 (2)", "4000 (2)", "6000 (2)", "8000 (2)"]


def extract_hearing(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = next(
        (s for s in xls.sheet_names if "ได้ยิน" in s or "Hearing" in s),
        None,
    )
    if sheet is None:
        sheet = resolve_sheet(xls, "สมรรถภาพการได้ยิน")

    df = read_sheet_data_block(path, sheet, allow_no_lamdup=True)

    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("สมรรถภาพการได้ยิน: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    right_cols = [c for c in RIGHT_FREQS if c in df.columns]
    left_cols = [c for c in LEFT_FREQS if c in df.columns]
    right_status = pick_col_contains_any(list(df.columns), ["หูขวา", "Right Ear", "Rt"])
    left_status = pick_col_contains_any(list(df.columns), ["หูซ้าย", "Left Ear", "Lt"])
    recommendation = pick_col_contains_any(
        list(df.columns),
        ["คำอธิบายการแปลผล", "คำแนะนำ", "Recommendation"],
    )
    if recommendation is None:
        recommendation = "Recommendation"
        df[recommendation] = ""

    def to_float(value):
        try:
            return float(str(value).strip())
        except Exception:
            return None

    def col_has_numbers(series: pd.Series) -> bool:
        sample = series.apply(lambda v: str(v).strip()).replace("", pd.NA).dropna().head(5)
        return sample.apply(to_float).notna().any()

    def is_excluded_col(name: str) -> bool:
        text = str(name)
        return any(
            key in text
            for key in [
                "สรุป",
                "ผลการตรวจ",
                "คำแนะนำ",
                "Recommendation",
                "หูขวา",
                "หูซ้าย",
                "Right Ear",
                "Left Ear",
            ]
        )

    if right_status in df.columns:
        right_idx = list(df.columns).index(right_status)
        candidate = [c for c in list(df.columns)[right_idx + 1:] if not is_excluded_col(c)]
        # Some sheets store the first frequency value under the right_status header itself.
        if col_has_numbers(df[right_status]):
            candidate = [right_status] + candidate
        candidate = candidate[:7]
        if len(candidate) == 7:
            right_cols = candidate

    if left_status in df.columns:
        left_idx = list(df.columns).index(left_status)
        candidate = [c for c in list(df.columns)[left_idx + 1:] if not is_excluded_col(c)]
        if col_has_numbers(df[left_status]):
            candidate = [left_status] + candidate
        candidate = candidate[:7]
        if len(candidate) == 7:
            left_cols = candidate

    use_fixed_grid = len(right_cols) < 7 or len(left_cols) < 7

    def avg_status(values):
        nums = [v for v in values if v is not None]
        if not nums:
            return ""
        avg = sum(nums) / len(nums)
        return "ผิดปกติ" if avg > 25 else "ปกติ"

    def normalize_parts(parts):
        if len(parts) < 14:
            parts = parts + [""] * (14 - len(parts))
        elif len(parts) > 14:
            parts = parts[:14]
        return parts

    if use_fixed_grid:
        # TL hearing sheets often use merged headers (Rt/Ear / Lt/Ear),
        # so attempt to map by header labels; fallback to fixed indices.
        raw_grid = pd.read_excel(path, sheet_name=sheet, header=None)
        freq_rows = []
        for i in range(min(40, len(raw_grid))):
            row = raw_grid.iloc[i].astype(str).fillna("").str.strip()
            joined = " ".join(row.values)
            if any(x in joined.lower() for x in ("500", "1k", "2k", "3k", "4k", "6k", "8k", "1000", "2000", "3000", "4000", "6000", "8000")):
                freq_rows.append(i)

        def parse_freq(val: str):
            v = str(val).strip().lower().replace("hz", "").replace(" ", "")
            if v in ("500",):
                return "500"
            if v in ("1k", "1000"):
                return "1000"
            if v in ("2k", "2000"):
                return "2000"
            if v in ("3k", "3000"):
                return "3000"
            if v in ("4k", "4000"):
                return "4000"
            if v in ("6k", "6000"):
                return "6000"
            if v in ("8k", "8000"):
                return "8000"
            return None

        def parse_ear(val: str):
            v = str(val).strip().lower()
            if "rt" in v or "right" in v or "ขวา" in v:
                return "right"
            if "lt" in v or "left" in v or "ซ้าย" in v:
                return "left"
            return None

        order = ["500", "1000", "2000", "3000", "4000", "6000", "8000"]
        mapped_right = {}
        mapped_left = {}
        ear_for_col = {}

        # Prefer a header row that contains BOTH right and left markers.
        best_entries = None
        fallback_entries = None
        for i in range(min(25, len(raw_grid))):
            row = raw_grid.iloc[i].astype(str).fillna("").str.strip()
            entries = []
            for col, val in enumerate(row):
                ear = parse_ear(val)
                if ear:
                    entries.append((col, ear))
            if not entries:
                continue
            if fallback_entries is None:
                fallback_entries = entries
            has_right = any(e == "right" for _, e in entries)
            has_left = any(e == "left" for _, e in entries)
            if has_right and has_left:
                best_entries = entries
                break

        entries = best_entries or fallback_entries or []
        if entries:
            entries.sort()
            for idx, (col, ear) in enumerate(entries):
                end = entries[idx + 1][0] - 1 if idx + 1 < len(entries) else raw_grid.shape[1] - 1
                for c in range(col, end + 1):
                    ear_for_col[c] = ear

        col_to_freq = {}
        for row_idx in freq_rows:
            for col in range(raw_grid.shape[1]):
                if col in col_to_freq:
                    continue
                freq = parse_freq(raw_grid.iloc[row_idx, col])
                if freq:
                    col_to_freq[col] = freq

        for col, freq in col_to_freq.items():
            ear = ear_for_col.get(col)
            if ear == "right":
                mapped_right[freq] = col
            elif ear == "left":
                mapped_left[freq] = col

        grid = read_hearing_grid_block(path, sheet)
        if len(mapped_right) == 7 and len(mapped_left) == 7:
            freq_cols = [mapped_right[f] for f in order] + [mapped_left[f] for f in order]
        else:
            freq_cols = list(range(10, 24))  # 7 right + 7 left

        def build_row(idx):
            parts = [cell_to_str(grid.iloc[idx, col]) for col in freq_cols]
            parts = normalize_parts(parts)
            right_vals = [to_float(grid.iloc[idx, col]) for col in freq_cols[:7]]
            left_vals = [to_float(grid.iloc[idx, col]) for col in freq_cols[7:14]]
            parts.append(avg_status(right_vals))
            parts.append(avg_status(left_vals))
            parts.append(cell_to_str(df.loc[idx, recommendation]))
            return ",".join(parts)

        result_series = pd.Series([build_row(i) for i in range(len(df))])
    else:
        hearing_cols = right_cols + left_cols
        result_series = fixed_concat_by_cols(df, hearing_cols)

        def build_row(idx):
            right_vals = [to_float(df.loc[idx, c]) for c in right_cols[:7]]
            left_vals = [to_float(df.loc[idx, c]) for c in left_cols[:7]]
            parts = [cell_to_str(df.loc[idx, c]) for c in hearing_cols]
            parts = normalize_parts(parts)
            parts.append(avg_status(right_vals))
            parts.append(avg_status(left_vals))
            parts.append(cell_to_str(df.loc[idx, recommendation]))
            return ",".join(parts)

        result_series = pd.Series([build_row(i) for i in range(len(df))])

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจสมรรถภาพการได้ยิน",
        "Result": result_series,
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
