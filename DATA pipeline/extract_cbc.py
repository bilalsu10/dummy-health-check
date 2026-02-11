import pandas as pd

from helpers import resolve_sheet, cell_to_str, norm_hn, pick_col_contains_any, read_sheet_data_block


def extract_cbc_summary(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "ความสมบูรณ์ของเลือด"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("ความสมบูรณ์ของเลือด: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    summary_col = pick_col_contains_any(list(df.columns), ["สรุปผล"])
    if summary_col is None:
        raise ValueError(f"CBC: Cannot find summary column. Available columns: {list(df.columns)}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจความสมบูรณ์ของเม็ดเลือด",
        "Result": df[summary_col].apply(cell_to_str),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
