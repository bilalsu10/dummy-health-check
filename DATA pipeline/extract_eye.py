import pandas as pd

from helpers import (
    cell_to_str,
    resolve_sheet,
    fixed_concat_by_cols,
    norm_hn,
    pick_col_contains_any,
    read_sheet_data_block,
)


def extract_eye(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    # TL uses the "สายตา" sheet with a 2-row header (identity row + eye row)
    if "\\TL\\" in path:
        sheet = resolve_sheet(xls, "สายตา")
    else:
        sheet = "?????????????"
        sheet = resolve_sheet(xls, sheet)

    if "\\TL\\" in path and sheet == "สายตา" and path.lower().endswith(".xls"):
        # Use xlrd directly to avoid Thai sheet-name encoding issues in pandas
        import xlrd

        book = xlrd.open_workbook(path, encoding_override="cp874")
        sh = None
        for name in book.sheet_names():
            if "สายตา" in name:
                sh = book.sheet_by_name(name)
                break
        if sh is None:
            sh = book.sheet_by_index(0)

        hdr_i = None
        for r in range(min(40, sh.nrows)):
            row = [str(sh.cell_value(r, c)).strip() for c in range(sh.ncols)]
            joined = " | ".join(v for v in row if v)
            if "ลำดับ" in joined and "ผลตรวจสมรรถภาพสายตาอาชีวอนามัย" in joined:
                hdr_i = r
                break
        if hdr_i is None:
            df = read_sheet_data_block(path, sheet)
        else:
            header_row = [str(sh.cell_value(hdr_i, c)).strip() for c in range(sh.ncols)]
            next_row = [str(sh.cell_value(hdr_i + 1, c)).strip() for c in range(sh.ncols)]
            headers = [n if n not in ("", "nan") else t for t, n in zip(header_row, next_row)]
            rows = []
            for r in range(hdr_i + 2, sh.nrows):
                row = [sh.cell_value(r, c) for c in range(sh.ncols)]
                if all(str(v).strip() == "" for v in row):
                    continue
                rows.append(row)
            df = pd.DataFrame(rows, columns=headers)
    elif "\\TL\\" in path and sheet == "สายตา":
        grid = pd.read_excel(path, sheet_name=sheet, header=None)
        hdr_i = None
        for i in range(min(20, len(grid))):
            row = grid.iloc[i].astype(str).fillna("")
            joined = " | ".join(v.strip() for v in row.values)
            if "ลำดับ" in joined and "ผลตรวจสมรรถภาพสายตาอาชีวอนามัย" in joined:
                hdr_i = i
                break
        if hdr_i is None:
            df = read_sheet_data_block(path, sheet)
        else:
            top_vals = [str(v).strip() for v in grid.iloc[hdr_i].tolist()]
            next_vals = [str(v).strip() for v in grid.iloc[hdr_i + 1].tolist()]
            merged = []
            for t, n in zip(top_vals, next_vals):
                val = n if n not in ("", "nan") else t
                merged.append(val)
            headers = merged
            data_start = hdr_i + 2
            df = grid.iloc[data_start:].copy()
            df.columns = headers
            df = df.dropna(how="all").reset_index(drop=True)
    else:
        df = read_sheet_data_block(path, sheet)

    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            # TL eye sheet uses employee ID instead of HN
            emp_col = pick_col_contains_any(list(df.columns), ["รหัสพนักงาน", "SCG", "SCG EmpID", "SCG_EmpID"])
            if emp_col is None:
                raise ValueError("?????????????: HN/EmpID column not found.")
            df["HN"] = df[emp_col]
        else:
            df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    cols = list(df.columns)
    identity_keys = [
        "HN",
        "????",
        "Name",
        "DOB",
        "???/?????/??????",
        "Age",
        "????",
        "Position",
        "???????",
        "Section",
        "????",
        "Department",
        "????????",
        "Division",
        "????",
        "??????",
        "???????????",
        "???????????",
        "SCG",
    ]

    def is_identity(col):
        s = str(col).replace("\n", "").replace(" ", "")
        return any(k.replace(" ", "") in s for k in identity_keys)

    identity_cols = {c for c in cols if is_identity(c)}
    eye_cols = [c for c in cols if c not in identity_cols]

    def is_tl_eye_sheet():
        return any("?????????????" in str(c) for c in cols) and any(
            "??????????????" in str(c) for c in cols
        )

    advice_col = pick_col_contains_any(cols, ["???????", "Recommendation"])
    if advice_col and advice_col in eye_cols:
        end_idx = eye_cols.index(advice_col) + 1
        eye_cols = eye_cols[:end_idx]

    if not eye_cols:
        raise ValueError("?????????????: No eye columns found after identity columns.")

    if is_tl_eye_sheet() or "\\TL\\" in path:
        # Prefer Thai column keywords from TL sheet
        col_far = pick_col_contains_any(cols, ["การมองระยะไกล"])
        col_near = pick_col_contains_any(cols, ["การมองระยะใกล้"])
        col_3d = pick_col_contains_any(cols, ["มองภาพ 3 มิติ", "มองภาพ3มิติ"])
        col_color = pick_col_contains_any(cols, ["การแยกสี"])
        col_balance = pick_col_contains_any(cols, ["ความสมดุลกล้ามเนื้อตา"])
        col_field = pick_col_contains_any(cols, ["ลานสายตา"])
        col_result = pick_col_contains_any(cols, ["สรุปสายตา", "สรุปผล", "ผลการตรวจ"])
        col_advice = pick_col_contains_any(cols, ["คำแนะนำ", "Recommendation"])

        # Fallback: if some columns are missing, map by position from non-identity columns
        if "\\TL\\" in path and "67" in path and any(x is None for x in [col_far, col_near, col_3d, col_color, col_balance, col_field, col_result]):
            if len(eye_cols) >= 7:
                col_far = col_far or eye_cols[0]
                col_near = col_near or eye_cols[1]
                col_3d = col_3d or eye_cols[2]
                col_color = col_color or eye_cols[3]
                col_balance = col_balance or eye_cols[4]
                col_field = col_field or eye_cols[5]
                col_result = col_result or eye_cols[6]

        # TL 68 Bill sheet mapping (merged header)
        bill_cols = []
        bill_df = None
        try:
            bill_sheet = resolve_sheet(xls, "Bill")
            bill_df = read_sheet_data_block(path, bill_sheet)
            bill_cols = list(bill_df.columns)
        except Exception:
            bill_df = None

        if bill_cols and all(x is None for x in [col_far, col_near, col_3d, col_color, col_balance, col_field]):
            bill_eye_start = pick_col_contains_any(bill_cols, ["ผลตรวจสมรรถภาพสายตาอาชีวะอนามัย"])
            bill_advice = pick_col_contains_any(bill_cols, ["คำแนะนำ"])
            bill_summary = pick_col_contains_any(bill_cols, ["สรุปสายตา", "สรุปผล"])

            if bill_eye_start:
                start_idx = bill_cols.index(bill_eye_start) + 1
                end_idx = bill_cols.index(bill_advice) if bill_advice in bill_cols else start_idx + 6
                eye_block = bill_cols[start_idx:end_idx]

                def pick_from_block(i):
                    return eye_block[i] if i < len(eye_block) else None

                col_far = pick_from_block(0)
                col_near = pick_from_block(1)
                col_3d = pick_from_block(2)
                col_color = pick_from_block(3)
                col_balance = pick_from_block(4)
                col_field = pick_from_block(5)
                if bill_summary:
                    col_result = bill_summary
                if bill_advice:
                    col_advice = bill_advice

                df = bill_df
                cols = list(df.columns)
            else:
                # Fallback: direct Thai column matching in Bill sheet
                df = bill_df
                cols = list(df.columns)
                col_far = pick_col_contains_any(cols, ["การมองระยะไกล"])
                col_near = pick_col_contains_any(cols, ["การมองระยะใกล้"])
                col_3d = pick_col_contains_any(cols, ["มองภาพ 3 มิติ", "มองภาพ3มิติ"])
                col_color = pick_col_contains_any(cols, ["การแยกสี"])
                col_balance = pick_col_contains_any(cols, ["ความสมดุลกล้ามเนื้อตา"])
                col_field = pick_col_contains_any(cols, ["ลานสายตา"])
                col_result = pick_col_contains_any(cols, ["สรุปสายตา", "สรุปผล"])
                col_advice = pick_col_contains_any(cols, ["คำแนะนำ", "Recommendation"])

        def build_row(idx):
            parts = [""] * 16
            # TL mapping (fixed index positions)
            if col_far:
                parts[1] = cell_to_str(df.loc[idx, col_far])
            if col_3d:
                parts[4] = cell_to_str(df.loc[idx, col_3d])
            if col_color:
                parts[5] = cell_to_str(df.loc[idx, col_color])
            if col_near:
                parts[8] = cell_to_str(df.loc[idx, col_near])
            if col_balance:
                parts[11] = cell_to_str(df.loc[idx, col_balance])
            if col_field:
                parts[13] = cell_to_str(df.loc[idx, col_field])
            if col_result:
                result_text = cell_to_str(df.loc[idx, col_result])
                # Replace commas in result text for clarity
                parts[14] = result_text.replace(",", " - ")
            if col_advice:
                parts[15] = cell_to_str(df.loc[idx, col_advice])
            return ",".join(parts)

        result_series = pd.Series([build_row(i) for i in range(len(df))])
    else:
        result_series = fixed_concat_by_cols(df, eye_cols)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "???????????????????????",
        "Result": result_series,
    }).merge(people, on="HN", how="left")

    def is_number(token: str) -> bool:
        try:
            float(token)
            return True
        except ValueError:
            return False

    def clean_eye_result(value: str) -> str:
        parts = [p.strip() for p in str(value).split(",")]
        while len(parts) > 16 and parts and parts[0] == "":
            parts = parts[1:]
        if len(parts) > 16 and parts and is_number(parts[0]):
            parts = parts[1:]
        if len(parts) > 16:
            parts = parts[:16]
        return ",".join(parts)

    out["Result"] = out["Result"].apply(clean_eye_result)

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
