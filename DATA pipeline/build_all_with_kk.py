from __future__ import annotations

from pathlib import Path
import re
import json
import pandas as pd


BASE = Path(__file__).resolve().parent
RAW = BASE / "raw"
ALL_DIR = RAW / "ALL"
KK_FINAL_DIR = RAW / "KK" / "Final"
TS_FINAL_ALL = RAW / "TS" / "Final" / "TS_FINAL_ALL.csv"
TL_FINAL_ALL = RAW / "TL" / "Final" / "TL_FINAL_ALL.csv"

PUBLIC_ALL_DIR = BASE.parent / "public" / "data" / "ALL"

FACTORY_ID_TS = 1
FACTORY_ID_TL = 2
FACTORY_ID_KK = 3

FINAL_COLUMNS = [
    "RowNo",
    "HN",
    "SCG_EmpID",
    "Name",
    "DOB",
    "Age",
    "Position",
    "Section",
    "Department",
    "Division",
    "Sex",
    "Occupational Vision Exam",
    "Hearing Test",
    "BMI",
    "Urine Arsenic",
    "Blood Pressure",
    "Blood Glucose",
    "Liver Function",
    "Kidney Function",
    "Uric Acid",
    "PSA (Prostate Specific Antigen)",
    "Amphetamine",
    "Blood Lead",
    "Urine Acetone",
    "Urine Mercury",
    "Urine Toluene",
    "Blood Cadmium",
    "Urine Xylene",
    "Urine Methyl Ethyl Ketone",
    "Urine Phenol",
    "CBC",
    "EKG",
    "Lung Function",
    "Stool Exam",
    "Urinalysis",
    "VA",
    "Chest X-ray",
]


def normalize_text(v: object) -> str:
    if pd.isna(v):
        return ""
    return str(v).strip()


def normalize_section_department(v: object) -> str:
    t = normalize_text(v)
    return t if t else "-"


def read_csv_or_empty(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    return pd.read_csv(path, dtype=str, encoding="utf-8-sig").fillna("")


def read_xlsx(path: Path) -> pd.DataFrame:
    return pd.read_excel(path, dtype=object).fillna("")


def build_kk_final_all() -> pd.DataFrame:
    files = sorted(KK_FINAL_DIR.glob("KK_FINAL_25*.xlsx"))
    rows: list[pd.DataFrame] = []
    for f in files:
        m = re.search(r"(25\d{2})", f.name)
        if not m:
            continue
        year = m.group(1)
        df = read_xlsx(f)
        for col in FINAL_COLUMNS:
            if col not in df.columns:
                df[col] = ""
        df = df[FINAL_COLUMNS].copy()
        df = df.fillna("")
        df["Year"] = year
        df["FactoryId"] = str(FACTORY_ID_KK)
        rows.append(df)
    if not rows:
        return pd.DataFrame(columns=["Year", "FactoryId", *FINAL_COLUMNS])
    out = pd.concat(rows, ignore_index=True)
    # Re-sequence per year for consistency
    out["RowNo"] = out.groupby("Year").cumcount() + 1
    out["RowNo"] = out["RowNo"].astype(str)
    return out[["Year", "FactoryId", *FINAL_COLUMNS]]


def extend_department_section_maps(df_all: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    departments_path = ALL_DIR / "departments.csv"
    sections_path = ALL_DIR / "sections.csv"
    factories_path = ALL_DIR / "factories.csv"

    departments = read_csv_or_empty(departments_path)
    sections = read_csv_or_empty(sections_path)
    factories = read_csv_or_empty(factories_path)

    if departments.empty:
        departments = pd.DataFrame(columns=["department_id", "department_name", "factory_id"])
    if sections.empty:
        sections = pd.DataFrame(columns=["section_id", "section_name", "department_id"])
    if factories.empty:
        factories = pd.DataFrame(columns=["factory_id", "factory_name"])

    # Ensure KK factory exists
    if not ((factories["factory_id"] == str(FACTORY_ID_KK)).any()):
        factories = pd.concat(
            [
                factories,
                pd.DataFrame([{"factory_id": str(FACTORY_ID_KK), "factory_name": "KK"}]),
            ],
            ignore_index=True,
        )

    work = df_all.copy()
    work["Department"] = work["Department"].map(normalize_section_department)
    work["Section"] = work["Section"].map(normalize_section_department)
    work["FactoryId"] = work["FactoryId"].map(normalize_text)

    existing_dept = {
        (normalize_text(r.department_name), normalize_text(r.factory_id)): normalize_text(r.department_id)
        for r in departments.itertuples(index=False)
    }
    max_dept = max([int(x) for x in departments["department_id"] if normalize_text(x).isdigit()] + [0])

    # Add missing departments
    for row in work[["Department", "FactoryId"]].drop_duplicates().itertuples(index=False):
        key = (normalize_text(row.Department), normalize_text(row.FactoryId))
        if key not in existing_dept:
            max_dept += 1
            existing_dept[key] = str(max_dept)
            departments = pd.concat(
                [
                    departments,
                    pd.DataFrame(
                        [
                            {
                                "department_id": str(max_dept),
                                "department_name": key[0],
                                "factory_id": key[1],
                            }
                        ]
                    ),
                ],
                ignore_index=True,
            )

    work["department_id"] = work.apply(
        lambda r: existing_dept.get((normalize_text(r["Department"]), normalize_text(r["FactoryId"])), ""),
        axis=1,
    )

    existing_section = {
        (normalize_text(r.section_name), normalize_text(r.department_id)): normalize_text(r.section_id)
        for r in sections.itertuples(index=False)
    }
    max_sec = max([int(x) for x in sections["section_id"] if normalize_text(x).isdigit()] + [0])

    # Add missing sections
    for row in work[["Section", "department_id"]].drop_duplicates().itertuples(index=False):
        key = (normalize_text(row.Section), normalize_text(row.department_id))
        if key not in existing_section:
            max_sec += 1
            existing_section[key] = str(max_sec)
            sections = pd.concat(
                [
                    sections,
                    pd.DataFrame(
                        [{"section_id": str(max_sec), "section_name": key[0], "department_id": key[1]}]
                    ),
                ],
                ignore_index=True,
            )

    work["section_id"] = work.apply(
        lambda r: existing_section.get((normalize_text(r["Section"]), normalize_text(r["department_id"])), ""),
        axis=1,
    )

    # Persist normalized maps
    departments = departments[["department_id", "department_name", "factory_id"]].fillna("")
    sections = sections[["section_id", "section_name", "department_id"]].fillna("")
    factories = factories[["factory_id", "factory_name"]].fillna("")

    return work, departments, sections, factories


def write_json(path: Path, df: pd.DataFrame) -> None:
    records = []
    for rec in df.fillna("").to_dict(orient="records"):
        clean = {}
        for k, v in rec.items():
            if pd.isna(v):
                clean[k] = ""
            else:
                clean[k] = str(v)
        records.append(clean)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    ALL_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_ALL_DIR.mkdir(parents=True, exist_ok=True)

    kk_all = build_kk_final_all()
    kk_all_path = KK_FINAL_DIR / "KK_FINAL_ALL.csv"
    kk_all.to_csv(kk_all_path, index=False, encoding="utf-8-sig")

    # Load existing TS/TL ALL sources and merge with KK
    ts = read_csv_or_empty(TS_FINAL_ALL)
    tl = read_csv_or_empty(TL_FINAL_ALL)
    if not ts.empty:
        ts["FactoryId"] = str(FACTORY_ID_TS)
    if not tl.empty:
        tl["FactoryId"] = str(FACTORY_ID_TL)
    all_merged = pd.concat([ts, tl, kk_all], ignore_index=True, sort=False).fillna("")

    # Ensure core columns exist
    for col in ["Year", "FactoryId", *FINAL_COLUMNS]:
        if col not in all_merged.columns:
            all_merged[col] = ""

    all_merged["FactoryId"] = all_merged["FactoryId"].map(normalize_text)
    all_merged["Department"] = all_merged["Department"].map(normalize_section_department)
    all_merged["Section"] = all_merged["Section"].map(normalize_section_department)

    all_enriched, departments, sections, factories = extend_department_section_maps(all_merged)

    ordered_cols = [
        "Year",
        "FactoryId",
        "RowNo",
        "HN",
        "SCG_EmpID",
        "Name",
        "DOB",
        "Age",
        "Position",
        "Section",
        "section_id",
        "Department",
        "department_id",
        "Division",
        "Occupational Vision Exam",
        "Hearing Test",
        "BMI",
        "Urine Arsenic",
        "Blood Pressure",
        "Blood Glucose",
        "Liver Function",
        "Kidney Function",
        "Uric Acid",
        "PSA (Prostate Specific Antigen)",
        "Amphetamine",
        "Blood Lead",
        "Urine Acetone",
        "Urine Mercury",
        "Urine Toluene",
        "Blood Cadmium",
        "Urine Xylene",
        "Urine Methyl Ethyl Ketone",
        "Urine Phenol",
        "CBC",
        "EKG",
        "Lung Function",
        "Stool Exam",
        "Urinalysis",
        "VA",
        "Chest X-ray",
        "Sex",
    ]
    for col in ordered_cols:
        if col not in all_enriched.columns:
            all_enriched[col] = ""
    all_enriched = all_enriched[ordered_cols].fillna("")

    # Write raw csv outputs
    all_csv_path = ALL_DIR / "ALL.csv"
    all_enriched.to_csv(all_csv_path, index=False, encoding="utf-8-sig")
    departments.to_csv(ALL_DIR / "departments.csv", index=False, encoding="utf-8-sig")
    sections.to_csv(ALL_DIR / "sections.csv", index=False, encoding="utf-8-sig")
    factories.to_csv(ALL_DIR / "factories.csv", index=False, encoding="utf-8-sig")

    # Write public JSON for UI
    write_json(PUBLIC_ALL_DIR / "all.json", all_enriched)
    write_json(PUBLIC_ALL_DIR / "departments.json", departments)
    write_json(PUBLIC_ALL_DIR / "sections.json", sections)
    write_json(PUBLIC_ALL_DIR / "factories.json", factories)

    print(f"[OK] {kk_all_path}")
    print(f"[OK] {all_csv_path}")
    print(f"[OK] {PUBLIC_ALL_DIR / 'all.json'}")
    print(f"[ROWS] KK={len(kk_all)} ALL={len(all_enriched)}")


if __name__ == "__main__":
    main()
