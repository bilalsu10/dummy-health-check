import pandas as pd

from helpers import resolve_sheet, cell_to_str, norm_hn, pick_col_contains_any, read_sheet_data_block


def extract_ecg(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "คลื่นไฟฟ้าหัวใจ"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("คลื่นไฟฟ้าหัวใจ: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    result_col = "ผลการตรวจคลื่นไฟฟ้าหัวใจ"  # locked exact name from you
    if result_col not in df.columns:
        raise ValueError(f"ECG: Missing result column '{result_col}'. Available: {list(df.columns)}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจคลื่นไฟฟ้าหัวใจ",
        "Result": df[result_col].apply(cell_to_str),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
