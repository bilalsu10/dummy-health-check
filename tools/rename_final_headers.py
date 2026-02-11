import pandas as pd
from pathlib import Path


MAPPING = {
    "ตรวจสายตาทางอาชีวอนามัย": "Occupational Vision Exam",
    "ตรวจสมรรถภาพการได้ยิน": "Hearing Test",
    "ดัชนีมวลกาย": "BMI",
    "ตรวจสารหนูในปัสสาวะ": "Urine Arsenic",
    "ความดันโลหิต": "Blood Pressure",
    "ตรวจน้ำตาลในเลือด": "Blood Glucose",
    "ตรวจการทำงานของตับ": "Liver Function",
    "ตรวจการทำงานของไต": "Kidney Function",
    "ตรวจกรดยูริคในเลือด": "Uric Acid",
    "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด": "PSA (Prostate Specific Antigen)",
    "ตรวจสารเสพติดในปัสสาวะ": "Amphetamine",
    "ตรวจสารตะกั่วในเลือด": "Blood Lead",
    "ตรวจสารอะซิโตนในปัสสาวะ": "Urine Acetone",
    "ตรวจสารปรอทในปัสสาวะ": "Urine Mercury",
    "ตรวจสารโทลูอีนในปัสสาวะ": "Urine Toluene",
    "ตรวจสารแคดเมียมในเลือด": "Blood Cadmium",
    "ตรวจสารไซลีนในปัสสาวะ": "Urine Xylene",
    "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ": "Urine Methyl Ethyl Ketone",
    "ตรวจสารฟีนอลในปัสสาวะ": "Urine Phenol",
    "ตรวจความสมบูรณ์ของเม็ดเลือด": "CBC",
    "ตรวจคลื่นไฟฟ้าหัวใจ": "EKG",
    "ตรวจสมรรถภาพปอด": "Lung Function",
    "ตรวจอุจจาระ": "Stool Exam",
    "ตรวจปัสสาวะสมบูรณ์แบบ": "Urinalysis",
    "ตรวจการมองเห็นระยะไกล": "VA",
    "ตรวจเอ็กซเรย์ปอด": "Chest X-ray",
}


def main() -> None:
    base = Path("DATA pipeline/raw")
    targets = [
        base / "TS" / "Final",
        base / "TL" / "Final",
    ]
    excel_files = []
    for folder in targets:
        if folder.exists():
            excel_files.extend(folder.glob("FINAL_*.xlsx"))

    for path in excel_files:
        df = pd.read_excel(path)
        df = df.rename(columns=MAPPING)
        df.to_excel(path, index=False)
        csv_path = path.with_suffix(".csv")
        df.to_csv(csv_path, index=False, encoding="utf-8-sig")

    print(f"Updated {len(excel_files)} Excel files and CSVs.")


if __name__ == "__main__":
    main()
