import pandas as pd
from pathlib import Path

# =========================
# CONFIG
# =========================
BASE_DIR = Path(__file__).resolve().parent
RAW_ROOT = BASE_DIR / "raw"
OUTPUT_ROOT = (BASE_DIR / ".." / "public" / "data").resolve()

from extract_bmi import extract_bmi
from extract_arsenic_urine import extract_arsenic_urine
from extract_blood_pressure import extract_blood_pressure
from extract_cbc import extract_cbc_summary
from extract_ekg import extract_ecg
from extract_eye import extract_eye
from extract_fbs import extract_fbs
from extract_hearing import extract_hearing
from extract_liver import extract_liver
from extract_lung import extract_lung
from extract_kidney import extract_kidney
from extract_psa import extract_psa
from extract_drug_urine import extract_drug_urine
from extract_lead_blood import extract_lead_blood
from extract_acetone_urine import extract_acetone_urine
from extract_mercury_urine import extract_mercury_urine
from extract_toluene_urine import extract_toluene_urine
from extract_cadmium_blood import extract_cadmium_blood
from extract_xylene_urine import extract_xylene_urine
from extract_methyl_urine import extract_methyl_urine
from extract_phenol_urine import extract_phenol_urine
from extract_stool import extract_stool
from extract_uric_acid import extract_uric_acid
from extract_urine import extract_urine
from extract_va import extract_va
from extract_Lung_xray import extract_xray
from people_master import load_people_master


def empty_result(people: pd.DataFrame, exam_item: str) -> pd.DataFrame:
    out = pd.DataFrame({
        "HN": people["HN"],
        "ExamItem": exam_item,
        "Result": "",
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


def _hn_is_sequential(series: pd.Series) -> bool:
    nums = pd.to_numeric(series, errors="coerce").dropna()
    if nums.empty:
        return False
    # Treat as sequential if most values are integers within 1..N
    if not (nums % 1 == 0).all():
        return False
    max_val = int(nums.max())
    return max_val <= len(series) and nums.min() >= 1


def safe_extract(fn, exam_item: str, path: str, xls: pd.ExcelFile, people: pd.DataFrame) -> pd.DataFrame:
    try:
        df = fn(path, xls, people)
        return df
    except Exception as err:
        print(f"Skip {exam_item}: {err}")
        return empty_result(people, exam_item)

# =========================
# Build ONE final combined table
# =========================
def build_final_table(path: str) -> pd.DataFrame:
    xls = pd.ExcelFile(path)

    # Always verify sheet names first (your instruction)
    people = load_people_master(path, xls)
    use_row_order = _hn_is_sequential(people["HN"])

    extractors = [
        (extract_eye, "ตรวจสายตาทางอาชีวอนามัย"),
        (extract_hearing, "ตรวจสมรรถภาพการได้ยิน"),
        (extract_bmi, "ดัชนีมวลกาย"),
        (extract_arsenic_urine, "ตรวจสารหนูในปัสสาวะ"),
        (extract_blood_pressure, "ความดันโลหิต"),
        (extract_fbs, "ตรวจน้ำตาลในเลือด"),
        (extract_liver, "ตรวจการทำงานของตับ"),
        (extract_kidney, "ตรวจการทำงานของไต"),
        (extract_uric_acid, "ตรวจกรดยูริคในเลือด"),
        (extract_psa, "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด"),
        (extract_drug_urine, "ตรวจสารเสพติดในปัสสาวะ"),
        (extract_lead_blood, "ตรวจสารตะกั่วในเลือด"),
        (extract_acetone_urine, "ตรวจสารอะซิโตนในปัสสาวะ"),
        (extract_mercury_urine, "ตรวจสารปรอทในปัสสาวะ"),
        (extract_toluene_urine, "ตรวจสารโทลูอีนในปัสสาวะ"),
        (extract_cadmium_blood, "ตรวจสารแคดเมียมในเลือด"),
        (extract_xylene_urine, "ตรวจสารไซลีนในปัสสาวะ"),
        (extract_methyl_urine, "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ"),
        (extract_phenol_urine, "ตรวจสารฟีนอลในปัสสาวะ"),
        (extract_cbc_summary, "ตรวจความสมบูรณ์ของเม็ดเลือด"),
        (extract_ecg, "ตรวจคลื่นไฟฟ้าหัวใจ"),
        (extract_lung, "ตรวจสมรรถภาพปอด"),
        (extract_stool, "ตรวจอุจจาระ"),
        (extract_urine, "ตรวจปัสสาวะสมบูรณ์แบบ"),
        (extract_va, "ตรวจการมองเห็นระยะไกล"),
        (extract_xray, "ตรวจเอ็กซเรย์ปอด"),
    ]
    frames = [
        safe_extract(fn, label, path, xls, people)
        for fn, label in extractors
    ]
    if use_row_order:
        for i, frame in enumerate(frames):
            if len(frame) == len(people):
                frames[i] = frame.assign(HN=people["HN"].values)

    final = pd.concat(frames, ignore_index=True)
    final = final[final["HN"].notna()].reset_index(drop=True)

    # Pivot so each person appears once, with one column per ExamItem.
    item_order = [label for _, label in extractors]

    results = final[["HN", "ExamItem", "Result"]].drop_duplicates(subset=["HN", "ExamItem"])
    wide = results.pivot(index="HN", columns="ExamItem", values="Result").reset_index()

    # Ensure consistent column order and include all items.
    for item in item_order:
        if item not in wide.columns:
            wide[item] = ""
    wide = wide[["HN"] + item_order]

    merged = people.merge(wide, on="HN", how="left")
    merged = merged.sort_values("RowNo").reset_index(drop=True)
    return merged

def detect_year(filename: str) -> str:
    name = filename.replace(" ", "")
    for token in ["2568", "2567", "2566", "2565", "68", "67", "66", "65"]:
        if token in name:
            return token[-2:]
    return "unknown"


def format_year_for_excel(year_token: str) -> str:
    if len(year_token) == 4 and year_token.isdigit():
        return year_token
    if len(year_token) == 2 and year_token.isdigit():
        return f"25{year_token}"
    return year_token


def run_for_file(path: str, section: str) -> None:
    final_df = build_final_table(path)
    year = detect_year(path)
    output_dir = OUTPUT_ROOT / section
    output_path = output_dir / f"final_{year}.json"
    excel_year = format_year_for_excel(year)
    excel_dir = RAW_ROOT / section / "Final"
    excel_path = excel_dir / f"FINAL_{excel_year}.xlsx"

    output_dir.mkdir(parents=True, exist_ok=True)
    excel_dir.mkdir(parents=True, exist_ok=True)
    final_df.to_json(output_path, orient="records", force_ascii=False, indent=2)
    final_df.to_excel(excel_path, index=False)
    print(f"Saved: {output_path}")
    print(f"Saved: {excel_path}")


def run_all() -> None:
    if not RAW_ROOT.exists():
        raise FileNotFoundError(f"RAW_ROOT not found: {RAW_ROOT.resolve()}")
    for section_dir in RAW_ROOT.iterdir():
        if not section_dir.is_dir():
            continue
        section = section_dir.name
        for file in section_dir.glob("*.xlsx"):
            run_for_file(str(file), section)


# =========================
# RUN
# =========================
if __name__ == "__main__":
    run_all()
