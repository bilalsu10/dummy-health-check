import pandas as pd

from helpers import resolve_sheet, cell_to_str, norm_hn, pick_col_contains_any, read_sheet_data_block


def _pick_sheet(xls: pd.ExcelFile) -> str:
    for candidate in xls.sheet_names:
        if "BMI+BP" in candidate:
            return candidate
        if "ความดันโลหิต+ดัชนีมวลกาย" in candidate:
            return candidate
    return resolve_sheet(xls, "ความดันโลหิต+ดัชนีมวลกาย")


def extract_blood_pressure(path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    sheet = _pick_sheet(xls)

    df = read_sheet_data_block(path, sheet, allow_no_lamdup=True)
    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N."])
        if hn_col is None:
            raise ValueError("ความดันโลหิต+ดัชนีมวลกาย: HN column not found.")
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    bp_col = pick_col_contains_any(list(df.columns), ["ผลตรวจ", "ผลการตรวจ"])
    if bp_col is None:
        bp_col = pick_col_contains_any(list(df.columns), ["ความดันโลหิต"])
    if bp_col is None:
        raise ValueError(f"Blood pressure: Cannot find column. Available columns: {list(df.columns)}")

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": "ความดันโลหิต",
        "Result": df[bp_col].apply(cell_to_str),
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
