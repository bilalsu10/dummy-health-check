import pandas as pd

from helpers import (
    resolve_sheet,
    fixed_concat_by_cols,
    norm_hn,
    pick_col_contains_any,
    read_sheet_data_block,
    read_bill_table,
)


def extract_lung(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    # TL: use Bill sheet "สรุปปอด" if available
    if "\\TL\\" in path:
        try:
            import re
            grid = None
            if path.lower().endswith(".xls"):
                try:
                    import xlrd
                    book = xlrd.open_workbook(path, encoding_override="cp874")
                    sheet = book.sheet_by_name("Bill")
                    grid = pd.DataFrame([sheet.row_values(r) for r in range(sheet.nrows)])
                except Exception:
                    grid = None
            if grid is None:
                grid = pd.read_excel(path, sheet_name="Bill", header=None)

            # Find Bill header row
            header_idx = None
            for i in range(min(60, len(grid))):
                row = [str(v).strip() for v in grid.iloc[i].tolist()]
                joined = " | ".join(row)
                if "BMI" in joined or "Systolic" in joined or "ความดัน" in joined:
                    header_idx = i
                    break
            if header_idx is None:
                raise ValueError("Bill header row not found")

            data = grid.iloc[header_idx + 1 :].copy()

            # Detect SCG_EmpID column
            emp_pat = re.compile(r"^\d{4}-\d{6}$")
            best_col = None
            best_count = 0
            for col_idx in range(data.shape[1]):
                vals = data.iloc[:, col_idx].astype(str).str.strip()
                count = vals.apply(lambda v: bool(emp_pat.match(v))).sum()
                if count > best_count:
                    best_count = count
                    best_col = col_idx

            # Locate "สรุปปอด" header cell if present; otherwise default to BY (index 76)
            result_col_idx = None
            header_row = grid.iloc[header_idx].astype(str).fillna("")
            for j, v in enumerate(header_row.tolist()):
                if "สรุปปอด" in v:
                    result_col_idx = j
                    break
            if result_col_idx is None:
                result_col_idx = 76

            res_vals = data.iloc[:, result_col_idx] if data.shape[1] > result_col_idx else pd.Series([""] * len(data))

            if best_col is not None and best_count > 0:
                emp_vals = data.iloc[:, best_col].astype(str).str.strip()
                temp = pd.DataFrame({
                    "SCG_EmpID": emp_vals,
                    "Result": res_vals.astype(str).str.strip(),
                })
                temp = temp[temp["SCG_EmpID"].str.match(emp_pat, na=False)]
                out = people.merge(temp, on="SCG_EmpID", how="left")
                out["ExamItem"] = "ตรวจสมรรถภาพปอด"
                return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]

            # Fallback: row alignment
            series = res_vals.astype(str).str.strip().reset_index(drop=True)
            people_reset = people.reset_index(drop=True)
            if len(series) == len(people_reset):
                out = people_reset.copy()
                out["ExamItem"] = "ตรวจสมรรถภาพปอด"
                out["Result"] = series
                return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
        except Exception:
            # If TL mapping fails, return empty results to avoid falling through
            out = people.copy()
            out["ExamItem"] = "ตรวจสมรรถภาพปอด"
            out["Result"] = ""
            return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]

    sheet = "สมรรถภาพปอด"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("สมรรถภาพปอด: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    result_col = pick_col_contains_any(list(df.columns), ["ผลการตรวจ"])
    advice_col = pick_col_contains_any(list(df.columns), ["คำแนะนำ"])
    if result_col is None or advice_col is None:
        raise ValueError(
            f"สมรรถภาพปอด: Cannot find ผลการตรวจ/คำแนะนำ. Available columns: {list(df.columns)}"
        )

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจสมรรถภาพปอด",
        "Result": fixed_concat_by_cols(df, [result_col, advice_col]),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
