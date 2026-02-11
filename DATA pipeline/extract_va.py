import pandas as pd

from helpers import resolve_sheet, cell_to_str, norm_hn, pick_col_contains_any, read_sheet_data_block


def extract_va(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = "สายตาระยะไกลVA"
    sheet = resolve_sheet(xls, sheet)

    df = read_sheet_data_block(path, sheet, allow_no_lamdup=True)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("สายตาระยะไกลVA: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    result_col = "ผลตรวจวัดการมองเห็นระยะไกล(VA)"
    if result_col not in df.columns:
        result_col = pick_col_contains_any(list(df.columns), ["มองเห็นระยะไกล", "VA", "ผลตรวจวัด"])
    if result_col is None:
        raise ValueError(f"สายตาระยะไกลVA: Missing result column. Available: {list(df.columns)}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ตรวจการมองเห็นระยะไกล",
        "Result": df[result_col].apply(cell_to_str),
    }).merge(people, on="HN", how="left")

    return out[["HN", "SCG_EmpID", "Name", "DOB", "Age", "Position", "Section", "Department", "Division", "ExamItem", "Result"]]
