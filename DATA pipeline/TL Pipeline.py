import pandas as pd
from pathlib import Path

from helpers import norm_hn, pick_col_contains_any, read_sheet_data_block
from people_master import load_people_master

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

# =========================
# CONFIG
# =========================
BASE_DIR = Path(__file__).resolve().parent
RAW_ROOT = BASE_DIR / "raw" / "TL" / "Raw"
OUTPUT_ROOT = (BASE_DIR / ".." / "public" / "data" / "TL").resolve()
EXCEL_OUT_DIR = BASE_DIR / "raw" / "TL" / "Final"

# Thai literals (escape-safe)
TH_RESULT = "ผลการตรวจ"
TH_RESULT_SHORT = "ผลตรวจ"
TH_EYE_SHEET = "สายตา"
TH_HEARING_SHEET = "การได้ยิน"
TH_LUNG_SHEET = "ปอด"
TH_EYE_RESULT = "ผลตรวจสมรรถภาพสายตาอาชีวอนามัย"
TH_EKG_SUM = "สรุปผลตรวจ"
TH_EKG_RESULT = "ผลการตรวจคลื่นไฟฟ้าหัวใจ (EKG)"
TH_LUNG_RESULT = "ผลการตรวจสมรรถภาพปอด"
TH_XRAY_RESULT = "ผลการเอ็กซเรย์ทรวงอก"
TH_STOOL_SUM = "สรุปผลตรวจอุจจาระ"

EN_ITEMS = {
    "Occupational Vision Exam": "ตรวจสายตาทางอาชีวอนามัย",
    "Hearing Test": "ตรวจสมรรถภาพการได้ยิน",
    "BMI": "ดัชนีมวลกาย",
    "Urine Arsenic": "ตรวจสารหนูในปัสสาวะ",
    "Blood Pressure": "ความดันโลหิต",
    "Blood Glucose": "ตรวจน้ำตาลในเลือด",
    "Liver Function": "ตรวจการทำงานของตับ",
    "Kidney Function": "ตรวจการทำงานของไต",
    "Uric Acid": "ตรวจกรดยูริคในเลือด",
    "PSA (Prostate Specific Antigen)": "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด",
    "Amphetamine": "ตรวจสารเสพติดในปัสสาวะ",
    "Blood Lead": "ตรวจสารตะกั่วในเลือด",
    "Urine Acetone": "ตรวจสารอะซิโตนในปัสสาวะ",
    "Urine Mercury": "ตรวจสารปรอทในปัสสาวะ",
    "Urine Toluene": "ตรวจสารโทลูอีนในปัสสาวะ",
    "Blood Cadmium": "ตรวจสารแคดเมียมในเลือด",
    "Urine Xylene": "ตรวจสารไซลีนในปัสสาวะ",
    "Urine Methyl Ethyl Ketone": "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ",
    "Urine Phenol": "ตรวจสารฟีนอลในปัสสาวะ",
    "CBC": "ตรวจความสมบูรณ์ของเม็ดเลือด",
    "EKG": "ตรวจคลื่นไฟฟ้าหัวใจ",
    "Lung Function": "ตรวจสมรรถภาพปอด",
    "Stool Exam": "ตรวจอุจจาระ",
    "Urinalysis": "ตรวจปัสสาวะสมบูรณ์แบบ",
    "VA": "ตรวจการมองเห็นระยะไกล",
    "Chest X-ray": "ตรวจเอ็กซเรย์ปอด",
}


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


def extract_from_sheet(path: str, sheet: str, people: pd.DataFrame, exam_item: str, result_cols: list[str]) -> pd.DataFrame:
    try:
        df = read_sheet_data_block(path, sheet, allow_no_lamdup=True)
    except Exception:
        return empty_result(people, exam_item)

    if "HN" not in df.columns:
        hn_col = pick_col_contains_any(list(df.columns), ["HN", "H.N.", "รหัสพนักงาน", "SCG Employee ID"])
        if hn_col is None:
            return empty_result(people, exam_item)
        df = df.rename(columns={hn_col: "HN"})
    df["HN"] = df["HN"].apply(norm_hn)

    result_col = pick_col_contains_any(list(df.columns), result_cols)
    if result_col is None:
        return empty_result(people, exam_item)

    out = pd.DataFrame({
        "HN": df["HN"],
        "ExamItem": exam_item,
        "Result": df[result_col].astype(str).str.strip(),
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


def safe_extract(fn, exam_item: str, path: str, xls: pd.ExcelFile, people: pd.DataFrame, fallback=None) -> pd.DataFrame:
    try:
        out = fn(path, xls, people)
        if "ExamItem" in out.columns:
            out["ExamItem"] = exam_item
        return out
    except Exception:
        if fallback is not None:
            try:
                out = fallback(path, xls, people)
                if "ExamItem" in out.columns:
                    out["ExamItem"] = exam_item
                return out
            except Exception:
                pass
        return empty_result(people, exam_item)


def build_final_table(path: str) -> pd.DataFrame:
    xls = pd.ExcelFile(path)
    people = load_people_master(path, xls)

    # TS-style combined logic, but keep English labels in final output.
    extractors = [
        (extract_eye, "Occupational Vision Exam"),
        (extract_hearing, "Hearing Test"),
        (extract_bmi, "BMI"),
        (extract_arsenic_urine, "Urine Arsenic"),
        (extract_blood_pressure, "Blood Pressure"),
        (extract_fbs, "Blood Glucose"),
        (extract_liver, "Liver Function"),
        (extract_kidney, "Kidney Function"),
        (extract_uric_acid, "Uric Acid"),
        (extract_psa, "PSA (Prostate Specific Antigen)"),
        (extract_drug_urine, "Amphetamine"),
        (extract_lead_blood, "Blood Lead"),
        (extract_acetone_urine, "Urine Acetone"),
        (extract_mercury_urine, "Urine Mercury"),
        (extract_toluene_urine, "Urine Toluene"),
        (extract_cadmium_blood, "Blood Cadmium"),
        (extract_xylene_urine, "Urine Xylene"),
        (extract_methyl_urine, "Urine Methyl Ethyl Ketone"),
        (extract_phenol_urine, "Urine Phenol"),
        (extract_cbc_summary, "CBC"),
        (extract_ecg, "EKG"),
        (extract_lung, "Lung Function"),
        (extract_stool, "Stool Exam"),
        (extract_urine, "Urinalysis"),
        (extract_va, "VA"),
        (extract_xray, "Chest X-ray"),
    ]

    fallback_map = {
        "Occupational Vision Exam": (TH_EYE_SHEET, [TH_EYE_RESULT, TH_RESULT, TH_RESULT_SHORT]),
        "Hearing Test": (TH_HEARING_SHEET, [TH_RESULT, TH_RESULT_SHORT]),
        "BMI": ("BMI ", [TH_RESULT, TH_RESULT_SHORT, "BMI"]),
        "Blood Pressure": ("BP", [TH_RESULT, TH_RESULT_SHORT, "Blood Pressure"]),
        "Blood Glucose": ("FBS", [TH_RESULT, TH_RESULT_SHORT]),
        "Liver Function": ("SGOT&SGPT", [TH_RESULT_SHORT, TH_RESULT]),
        "Kidney Function": ("BUN", [TH_RESULT_SHORT, TH_RESULT]),
        "CBC": ("CBC", ["สรุป CBC", TH_RESULT_SHORT, TH_RESULT]),
        "EKG": ("EKG", [TH_EKG_SUM, TH_EKG_RESULT, TH_RESULT, TH_RESULT_SHORT]),
        "Lung Function": (TH_LUNG_SHEET, [TH_LUNG_RESULT, TH_RESULT, TH_RESULT_SHORT]),
        "Urinalysis": ("UA", [TH_RESULT_SHORT, TH_RESULT]),
        "Chest X-ray": ("x-ray ", [TH_XRAY_RESULT, TH_RESULT, TH_RESULT_SHORT]),
        "Amphetamine": ("Amp", [TH_RESULT, TH_RESULT_SHORT]),
        "Blood Lead": ("Lead", [TH_RESULT, TH_RESULT_SHORT]),
        "Blood Cadmium": ("Cadmium", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Arsenic": ("Arsenic", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Toluene": ("Toluene", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Methyl Ethyl Ketone": ("Methanol", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Acetone": ("Acetone", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Xylene": ("Xylene", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Mercury": ("Chromium", [TH_RESULT, TH_RESULT_SHORT]),
        "Urine Phenol": ("Phenol", [TH_RESULT, TH_RESULT_SHORT]),
        "PSA (Prostate Specific Antigen)": ("PSA", [TH_RESULT, TH_RESULT_SHORT]),
        "Stool Exam": ("Stool", [TH_STOOL_SUM, TH_RESULT, TH_RESULT_SHORT]),
    }

    frames = []
    for fn, exam_item in extractors:
        fallback = None
        if exam_item in fallback_map:
            sheet, result_cols = fallback_map[exam_item]
            fallback = lambda p, x, ppl, s=sheet, r=result_cols, e=exam_item: extract_from_sheet(p, s, ppl, e, r)
        frames.append(safe_extract(fn, exam_item, path, xls, people, fallback=fallback))

    final = pd.concat(frames, ignore_index=True)
    final = final[final["HN"].notna()].reset_index(drop=True)

    item_order = [label for _, label in extractors]
    results = final[["HN", "ExamItem", "Result"]].drop_duplicates(subset=["HN", "ExamItem"])
    wide = results.pivot(index="HN", columns="ExamItem", values="Result").reset_index()
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


def run_for_file(path: str) -> None:
    final_df = build_final_table(path)
    # TL: PSA not present in Bill across years; keep blank in final.
    if "PSA (Prostate Specific Antigen)" in final_df.columns:
        final_df["PSA (Prostate Specific Antigen)"] = ""
    # TL requirement: keep HN blank in final output while still using it internally.
    if "HN" in final_df.columns:
        final_df["HN"] = ""
    year = detect_year(path)
    output_path = OUTPUT_ROOT / f"final_{year}.json"
    excel_year = format_year_for_excel(year)
    excel_path = EXCEL_OUT_DIR / f"FINAL_{excel_year}.xlsx"

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    EXCEL_OUT_DIR.mkdir(parents=True, exist_ok=True)
    final_df.to_json(output_path, orient="records", force_ascii=False, indent=2)
    final_df.to_excel(excel_path, index=False)
    print(f"Saved: {output_path}")
    print(f"Saved: {excel_path}")


def run_all() -> None:
    if not RAW_ROOT.exists():
        raise FileNotFoundError(f"RAW_ROOT not found: {RAW_ROOT.resolve()}")
    for file in RAW_ROOT.glob("*.xls*"):
        if file.name.startswith("~$"):
            continue
        run_for_file(str(file))


if __name__ == "__main__":
    run_all()
