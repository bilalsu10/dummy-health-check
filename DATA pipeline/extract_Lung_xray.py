import pandas as pd

from helpers import resolve_sheet, cell_to_str, norm_hn, pick_col_contains_any, read_sheet_data_block


def extract_xray(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "เอกซเรย์ปอด"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("เอกซเรย์ปอด: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    result_col = "ผลการตรวจเอกซเรย์ปอด"
    if result_col not in df.columns:
        # Fallback for slightly different header names.
        result_col = pick_col_contains_any(list(df.columns), ["เอกซเรย์ปอด", "ผลการตรวจ"])
    if result_col is None:
        raise ValueError(f"เอกซเรย์ปอด: Missing result column. Available: {list(df.columns)}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจเอ็กซเรย์ปอด",
        "Result": df[result_col].apply(cell_to_str),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
