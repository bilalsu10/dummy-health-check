"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchDatasetJson } from "@/lib/dataPath";
import { matchesFactory } from "@/lib/factory";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

type ChartDatum = {
  name: string;
  value: number;
};

type TestDatum = {
  name: string;
  normal: number;
  abnormal: number;
  notTested: number;
  other: number;
};

const BMI_KEY = "BMI";
const BP_KEY = "Blood Pressure";
const OVERALL_MEDICAL_TEST_KEYS = [
  "BMI",
  "Blood Pressure",
  "Blood Glucose",
  "Lipid Profile",
  "Kidney Function",
  "Liver Function",
  "Uric Acid",
] as const;

const DEMOGRAPHICS_KEYS = [
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
];

const VITALS_KEYS = ["BMI", "Blood Pressure", "Blood Glucose", "Lipid Profile"];

const VISION_HEARING_KEYS = ["Occupational Vision Exam", "VA", "Hearing Test"];

const LAB_CHEMISTRY_KEYS = [
  "Liver Function",
  "Kidney Function",
];

const STOOL_KEYS = ["Stool Exam"];

const IMAGING_FUNCTIONAL_KEYS = ["Lung Function"];

const URINE_KEYS = [
  "Urinalysis",
  "Urine Arsenic",
  "Urine Acetone",
  "Urine Mercury",
  "Urine Toluene",
  "Urine Xylene",
  "Urine Methyl Ethyl Ketone",
  "Urine Phenol",
  "Amphetamine",
];

const BLOOD_TEST_KEYS = [
  "Blood Lead",
  "Blood Cadmium",
  "Uric Acid",
  "PSA (Prostate Specific Antigen)",
  "CBC",
];

const ITEM_LINKS: Record<string, string> = {
  "Hearing Test": "/admin/health-check/health-risk/ear",
  "BMI": "/admin/health-check/health-risk/bmi",
  "Blood Pressure": "/admin/health-check/health-risk/bp",
  "Blood Glucose": "/admin/health-check/health-risk/blood-glucose",
  "Occupational Vision Exam": "/admin/health-check/health-risk/eyes",
  "VA": "/admin/health-check/health-risk/eyes-va",
  "Liver Function": "/admin/health-check/health-risk/liver-function",
  "Kidney Function": "/admin/health-check/health-risk/kidney-function",
  "Uric Acid": "/admin/health-check/health-risk/uric-acid",
  "Lipid Profile": "/admin/health-check/health-risk/lipid-profile",
  "PSA (Prostate Specific Antigen)": "/admin/health-check/health-risk/psa",
  "Amphetamine": "/admin/health-check/health-risk/amphetamine",
  "Blood Lead": "/admin/health-check/health-risk/blood-lead",
  "Blood Cadmium": "/admin/health-check/health-risk/blood-cadmium",
  "Urinalysis": "/admin/health-check/health-risk/urinalysis",
  "Urine Arsenic": "/admin/health-check/health-risk/arsenic",
  "Urine Acetone": "/admin/health-check/health-risk/urine-acetone",
  "Urine Mercury": "/admin/health-check/health-risk/urine-mercury",
  "Urine Toluene": "/admin/health-check/health-risk/urine-toluene",
  "Urine Xylene": "/admin/health-check/health-risk/urine-xylene",
  "Urine Methyl Ethyl Ketone": "/admin/health-check/health-risk/urine-methyl-ethyl-ketone",
  "Urine Phenol": "/admin/health-check/health-risk/urine-phenol",
  "CBC": "/admin/health-check/health-risk/cbc",
  "EKG": "/admin/health-check/health-risk/ekg",
  "Lung Function": "/admin/health-check/health-risk/lung-function",
  "Stool Exam": "/admin/health-check/health-risk/stool",
  "Chest X-ray": "/admin/health-check/health-risk/chest-xray",
};

const ITEM_LABELS: Record<string, string> = {
  "Hearing Test": "ตรวจการได้ยิน",
  "Occupational Vision Exam": "ตรวจการมองเห็นจากงานอาชีวเวชกรรม",
  VA: "ตรวจวัดสายตา (VA)",
  BMI: "ดัชนีมวลกาย (BMI)",
  "Blood Pressure": "ความดันโลหิต",
  "Blood Glucose": "ระดับน้ำตาลในเลือด",
  "Liver Function": "ตรวจการทำงานของตับ",
  "Urine Arsenic": "ตรวจสารหนูในปัสสาวะ (Arsenic in Urine)",
  "Stool Exam": "ตรวจอุจจาระ (Stool Examination)",
  "Kidney Function": "ตรวจการทำงานของไต",
  "Uric Acid": "ตรวจกรดยูริคในเลือด",
  "Lipid Profile": "ไขมันในเลือด (Lipid Profile)",
  "PSA (Prostate Specific Antigen)": "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด (PSA)",
  "Amphetamine": "ตรวจสารเสพติดในปัสสาวะ",
  "Blood Lead": "ตรวจสารตะกั่วในเลือด (Lead)",
  Urinalysis: "ตรวจปัสสาวะ (Urinalysis)",
  "Urine Acetone": "ตรวจสารอะซีโตนในปัสสาวะ (Acetone in Urine)",
  "Urine Mercury": "ตรวจสารปรอทในปัสสาวะ (Mercury in Urine)",
  "Urine Toluene": "ตรวจสารโทลูอีนในปัสสาวะ (Toluene)",
  "Blood Cadmium": "ตรวจสารแคดเมียมในเลือด (Cadmium in Blood)",
  "Urine Xylene": "ตรวจสารไซลีนในปัสสาวะ (Xylene)",
  "Urine Methyl Ethyl Ketone": "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ (Methyl Ethyl Ketone in Urine)",
  "Urine Phenol": "ตรวจสารฟีนอลในปัสสาวะ (Phenol)",
  CBC: "ตรวจความสมบูรณ์ของเม็ดเลือด (CBC)",
  EKG: "ตรวจคลื่นไฟฟ้าหัวใจ (EKG)",
  "Lung Function": "ตรวจสมรรถภาพปอด",
  "Chest X-ray": "เอกซเรย์ทรวงอก (Chest X-ray)",
};

const getItemLabel = (item: string) => ITEM_LABELS[item] ?? item;


type ItemGroup = { key: string; title: string; items: string[] };

const GROUPS: ItemGroup[] = [
  { key: "Vitals", title: "ตรวจเบื้องต้น (Vitals)", items: VITALS_KEYS },
  { key: "Vision & Hearing", title: "การมองเห็นและการได้ยิน (Vision & Hearing)", items: VISION_HEARING_KEYS },
  { key: "Lab Chemistry", title: "เคมีคลินิก (Lab Chemistry)", items: LAB_CHEMISTRY_KEYS },
  { key: "Urine & Toxicology", title: "ปัสสาวะและสารพิษ (Urine & Toxicology)", items: URINE_KEYS },
  { key: "Blood Test", title: "สารเคมีในเลือด (Blood Test)", items: BLOOD_TEST_KEYS },
  { key: "Imaging & Functional", title: "ภาพวินิจฉัยและการทำงาน (Imaging & Functional)", items: IMAGING_FUNCTIONAL_KEYS },
  { key: "EKG", title: "ตรวจคลื่นไฟฟ้าหัวใจ (EKG)", items: ["EKG"] },
  { key: "Chest X-ray", title: "เอกซเรย์ทรวงอก (Chest X-ray)", items: ["Chest X-ray"] },
  { key: "Stool", title: "อุจจาระ (Stool)", items: STOOL_KEYS },
];

const TEST_COLUMNS: Array<{ key: string; label: string }> = VITALS_KEYS.map((key) => ({
  key,
  label: getItemLabel(key),
}));

const PIE_COLORS = ["#4C7A5A", "#B94A48", "#B07C2D", "#6B7280"];

const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getRowYear = (row: HealthRow) =>
  normalizeValue(row.Year ?? row.year ?? row["ปี"] ?? row["year"]);

const includeAny = (value: string, targets: string[]) =>
  targets.some((target) => value.includes(target));

const isNotTested = (value: string) => {
  const normalized = value.trim();
  const isDashOnly = /^[\-\u2010-\u2015\u2212]+(\s*,\s*[\-\u2010-\u2015\u2212]+)*$/.test(normalized);

  return isDashOnly || includeAny(normalized, ["ไม่ได้รับการตรวจ", "ไม่รับการตรวจ", "ไม่ตรวจ"]);
};

const categorizeBmi = (value: string) => {
  const raw = value.trim();
  if (!raw) return "ไม่ได้รับการตรวจ";
  const [numericText] = raw.split(",");
  const numeric = Number.parseFloat(numericText);

  if (value.includes("สมส่วน")) return "ปกติ";
  if (value.includes("ปกติ")) return "ปกติ";
  if (value.includes("อ้วนอันตราย")) return "อ้วนอันตราย";
  if (value.includes("น้ำหนักน้อย") || value.includes("ผอม")) return "ผอม";
  if (value.includes("น้ำหนักเกินเกณฑ์")) return "น้ำหนักเกิน";
  if (value.includes("น้ำหนักตัวมากกว่าเกณฑ์ปกติ")) return "น้ำหนักเกิน";
  if (value.includes("มากกว่าเกณฑ์ปกติ")) return "น้ำหนักเกิน";
  if (value.includes("อ้วน")) return "อ้วน";
  if (value.includes("น้ำหนักต่ำกว่าเกณฑ์")) return "ผอม";
  if (isNotTested(value)) return "ไม่ได้รับการตรวจ";
  if (Number.isFinite(numeric)) {
    if (numeric < 18.5) return "ผอม";
    if (numeric <= 22.9) return "ปกติ";
    if (numeric <= 24.9) return "น้ำหนักเกิน";
    if (numeric <= 29.9) return "อ้วน";
    return "อ้วนอันตราย";
  }
  return "อื่นๆ";
};

const categorizeBp = (value: string) => {
  if (value.includes("ต่ำ")) return "ต่ำ";
  if (value.includes("สูง")) return "สูง";
  if (value.includes("ปกติ")) return "ปกติ";
  if (isNotTested(value)) return "ไม่ได้รับการตรวจ";
  return "อื่นๆ";
};

const categorizeNormalAbnormal = (value: string) => {
  if (value.includes("ผิดปกติ")) return "abnormal";
  if (value.includes("ปกติ")) return "normal";
  if (isNotTested(value)) return "notTested";
  return "other";
};

const categorizeBloodGlucose = (value: string) => {
  const normalized = normalizeValue(value);
  if (!normalized || isNotTested(normalized)) return "ไม่ได้รับการตรวจ";
  const first = normalized.split(",")[0]?.trim() ?? "";
  const numeric = Number.parseFloat(first);
  if (!Number.isFinite(numeric)) {
    if (normalized.includes("เบาหวาน")) return "เบาหวาน";
    if (normalized.includes("เสี่ยง")) return "เสี่ยงเบาหวาน";
    if (normalized.includes("ปกติ")) return "ปกติ";
    return "อื่นๆ";
  }
  if (numeric < 70) return "ต่ำกว่าปกติ";
  if (numeric < 100) return "ปกติ";
  if (numeric <= 125) return "เสี่ยงเบาหวาน";
  return "เบาหวาน";
};

const parseLipidValues = (value: string) => {
  const parts = normalizeValue(value)
    .split(",")
    .map((p) => p.trim());
  const toNum = (text?: string) => {
    const n = Number.parseFloat(text ?? "");
    return Number.isFinite(n) ? n : null;
  };
  return {
    tc: toNum(parts[0]),
    tg: toNum(parts[1]),
    hdl: toNum(parts[2]),
    ldl: toNum(parts[3]),
  };
};

const categorizeLipidProfile = (value: string) => {
  const normalized = normalizeValue(value);
  if (!normalized || isNotTested(normalized)) return "ไม่ได้รับการตรวจ";

  const { tc, tg, hdl, ldl } = parseLipidValues(normalized);
  const hasNumeric = [tc, tg, hdl, ldl].some((v) => v !== null);

  if (!hasNumeric) {
    if (normalized.includes("ปกติ")) return "ปกติ";
    if (normalized.includes("ผิดปกติ")) return "เสี่ยงต่อสุขภาพ";
    return "อื่นๆ";
  }

  const warningItems: string[] = [];
  const riskItems: string[] = [];

  if (hdl !== null) {
    if (hdl < 35) riskItems.push("HDL");
    else if (hdl < 60) warningItems.push("HDL");
  }

  if (ldl !== null) {
    if (ldl >= 160) riskItems.push("LDL");
    else if (ldl > 130) warningItems.push("LDL");
  }

  if (tg !== null) {
    if (tg >= 200) riskItems.push("Triglyceride");
    else if (tg >= 150) warningItems.push("Triglyceride");
  }

  if (tc !== null) {
    if (tc >= 240) riskItems.push("Total Cholesterol");
    else if (tc >= 200) warningItems.push("Total Cholesterol");
  }

  if (riskItems.length > 0) return "เสี่ยงต่อสุขภาพ";
  if (warningItems.length > 0) return "เฝ้าระวัง";
  return "ปกติ";
};

const getLipidStatusWithItems = (value: string) => {
  const normalized = normalizeValue(value);
  if (!normalized || isNotTested(normalized)) {
    return { status: "ไม่ได้รับการตรวจ", warningItems: [] as string[], riskItems: [] as string[] };
  }
  const { tc, tg, hdl, ldl } = parseLipidValues(normalized);
  const warningItems: string[] = [];
  const riskItems: string[] = [];

  if (hdl !== null) {
    if (hdl < 35) riskItems.push("HDL");
    else if (hdl < 60) warningItems.push("HDL");
  }
  if (ldl !== null) {
    if (ldl >= 160) riskItems.push("LDL");
    else if (ldl > 130) warningItems.push("LDL");
  }
  if (tg !== null) {
    if (tg >= 200) riskItems.push("Triglyceride");
    else if (tg >= 150) warningItems.push("Triglyceride");
  }
  if (tc !== null) {
    if (tc >= 240) riskItems.push("Total Cholesterol");
    else if (tc >= 200) warningItems.push("Total Cholesterol");
  }

  if (riskItems.length > 0) return { status: "เสี่ยงต่อสุขภาพ", warningItems, riskItems };
  if (warningItems.length > 0) return { status: "เฝ้าระวัง", warningItems, riskItems };
  return { status: "ปกติ", warningItems, riskItems };
};

const isAbnormalByTest = (testKey: string, value: string) => {
  const normalized = normalizeValue(value);
  if (!normalized || isNotTested(normalized)) return false;

  if (testKey === "Blood Pressure") {
    return normalized.includes("สูง") || normalized.includes("ต่ำ");
  }

  if (testKey === "BMI") {
    const bmiCategory = categorizeBmi(normalized);
    return bmiCategory !== "ปกติ" && bmiCategory !== "ไม่ได้รับการตรวจ" && bmiCategory !== "อื่นๆ";
  }

  if (testKey === "Blood Glucose") {
    const glucoseCategory = categorizeBloodGlucose(normalized);
    return glucoseCategory !== "ปกติ" && glucoseCategory !== "ไม่ได้รับการตรวจ" && glucoseCategory !== "อื่นๆ";
  }

  if (testKey === "Uric Acid") {
    if (
      normalized.includes("ผิดปกติ") ||
      normalized.includes("สูงกว่าปกติ") ||
      normalized.includes("ต่ำกว่าปกติ")
    ) {
      return true;
    }
  }

  if (testKey === "Lipid Profile") {
    const lipidCategory = categorizeLipidProfile(normalized);
    return lipidCategory !== "ปกติ" && lipidCategory !== "ไม่ได้รับการตรวจ" && lipidCategory !== "อื่นๆ";
  }

  if (testKey === "Liver Function") {
    return (
      normalized.includes("ผิดปกติ") ||
      normalized.includes("SGOT") ||
      normalized.includes("SGPT") ||
      normalized.includes("ALKP")
    );
  }

  if (testKey === "Kidney Function") {
    return normalized.includes("ผิดปกติ");
  }

  return categorizeNormalAbnormal(normalized) === "abnormal";
};

const severityRank = (level: "เล็กน้อย" | "ปานกลาง" | "รุนแรง") =>
  level === "รุนแรง" ? 3 : level === "ปานกลาง" ? 2 : 1;

const severityFromBounds = (value: number, min: number | null, max: number | null) => {
  if (min !== null && value < min) {
    const ratio = min / Math.max(value, 0.0001);
    if (ratio >= 2) return "รุนแรง" as const;
    if (ratio >= 1.5) return "ปานกลาง" as const;
    return "เล็กน้อย" as const;
  }
  if (max !== null && value > max) {
    const ratio = value / max;
    if (ratio >= 2) return "รุนแรง" as const;
    if (ratio >= 1.5) return "ปานกลาง" as const;
    return "เล็กน้อย" as const;
  }
  return null;
};

const getPersonalStatusLabel = (testKey: string, rawValue: string, sexValue?: unknown) => {
  const raw = normalizeValue(rawValue);
  if (!raw || isNotTested(raw)) return "ไม่ได้รับการตรวจ";

  if (testKey === "BMI") {
    return categorizeBmi(raw);
  }

  if (testKey === "Blood Pressure") {
    if (raw.includes("สูง")) return "ความดันสูง";
    if (raw.includes("ต่ำ")) return "ความดันต่ำ";
    if (raw.includes("ปกติ")) return "ปกติ";
    return "อื่นๆ";
  }

  if (testKey === "Blood Glucose") {
    return categorizeBloodGlucose(raw);
  }

  if (testKey === "Uric Acid") {
    const first = raw.split(",")[0]?.trim() ?? "";
    const numeric = Number.parseFloat(first);
    if (!Number.isFinite(numeric)) {
      if (raw.includes("สูงกว่าปกติ")) return "สูงกว่าปกติ";
      if (raw.includes("ต่ำกว่าปกติ")) return "ต่ำกว่าปกติ";
      if (raw.includes("ปกติ")) return "ปกติ";
      return "อื่นๆ";
    }

    const sexText = normalizeValue(sexValue).toLowerCase();
    const isFemale =
      sexText.includes("หญิง") || sexText === "f" || sexText.includes("female");
    const min = isFemale ? 2.4 : 3.4;
    const max = isFemale ? 6.0 : 7.0;

    if (numeric < min) return "ต่ำกว่าปกติ";
    if (numeric > max) return "สูงกว่าปกติ";
    return "ปกติ";
  }

  if (testKey === "Liver Function") {
    const parts = raw.split(",").map((p) => p.trim());
    const toNum = (text?: string) => {
      const n = Number.parseFloat(text ?? "");
      return Number.isFinite(n) ? n : null;
    };
    const sgot = toNum(parts[0]);
    const sgpt = toNum(parts[1]);
    const alkp = toNum(parts[2]);
    const hasNumeric = [sgot, sgpt, alkp].some((v) => v !== null);
    if (!hasNumeric) return "อื่นๆ";

    const abnormalItems: string[] = [];
    let highest: "เล็กน้อย" | "ปานกลาง" | "รุนแรง" | null = null;

    if (sgot !== null) {
      const sev = severityFromBounds(sgot, 15, 46);
      if (sev) {
        abnormalItems.push("SGOT");
        if (!highest || severityRank(sev) > severityRank(highest)) highest = sev;
      }
    }
    if (sgpt !== null) {
      const sev = severityFromBounds(sgpt, null, 50);
      if (sev) {
        abnormalItems.push("SGPT");
        if (!highest || severityRank(sev) > severityRank(highest)) highest = sev;
      }
    }
    if (alkp !== null) {
      const sev = severityFromBounds(alkp, 38, 126);
      if (sev) {
        abnormalItems.push("ALKP");
        if (!highest || severityRank(sev) > severityRank(highest)) highest = sev;
      }
    }

    return abnormalItems.length ? `ผิดปกติ${highest ?? "เล็กน้อย"} (${abnormalItems.join(", ")})` : "ปกติ";
  }

  if (testKey === "Kidney Function") {
    const parts = raw.split(",").map((p) => p.trim());
    const toNum = (text?: string) => {
      const n = Number.parseFloat(text ?? "");
      return Number.isFinite(n) ? n : null;
    };
    const bun = toNum(parts[0]);
    const creatinine = toNum(parts[1]);
    const hasNumeric = bun !== null || creatinine !== null;
    if (!hasNumeric) return "อื่นๆ";

    const sexText = normalizeValue(sexValue).toLowerCase();
    const isFemale =
      sexText.includes("หญิง") || sexText === "f" || sexText.includes("female");

    const bunMin = isFemale ? 7 : 9;
    const bunMax = isFemale ? 17 : 20;
    const crMin = isFemale ? 0.52 : 0.66;
    const crMax = isFemale ? 1.04 : 1.25;

    const abnormalItems: string[] = [];
    let highest: "เล็กน้อย" | "ปานกลาง" | "รุนแรง" | null = null;

    if (bun !== null) {
      const sev = severityFromBounds(bun, bunMin, bunMax);
      if (sev) {
        abnormalItems.push("BUN");
        if (!highest || severityRank(sev) > severityRank(highest)) highest = sev;
      }
    }
    if (creatinine !== null) {
      const sev = severityFromBounds(creatinine, crMin, crMax);
      if (sev) {
        abnormalItems.push("Creatinine");
        if (!highest || severityRank(sev) > severityRank(highest)) highest = sev;
      }
    }

    return abnormalItems.length ? `ผิดปกติ${highest ?? "เล็กน้อย"} (${abnormalItems.join(", ")})` : "ปกติ";
  }

  if (testKey === "Lipid Profile") {
    const lipid = getLipidStatusWithItems(raw);
    if (lipid.status === "ปกติ") return "ปกติ";
    if (lipid.status === "ไม่ได้รับการตรวจ") return "ไม่ได้รับการตรวจ";
    const items = [...lipid.riskItems, ...lipid.warningItems];
    return items.length ? `${lipid.status} (${items.join(", ")})` : lipid.status;
  }

  if (isAbnormalByTest(testKey, raw)) return "ผิดปกติ";

  const genericBucket = categorizeNormalAbnormal(raw);
  if (genericBucket === "normal") return "ปกติ";

  if (testKey === "Blood Glucose" || testKey === "Uric Acid") {
    const numeric = Number.parseFloat(raw.split(",")[0]?.trim() ?? "");
    if (Number.isFinite(numeric)) return "ปกติ";
  }

  return "อื่นๆ";
};

const extractStatusItems = (status: string) => {
  const match = status.match(/\(([^)]+)\)/);
  if (!match) return [] as string[];
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const extractSeverityFromStatus = (status: string) => {
  const match = status.match(/^ผิดปกติ(เล็กน้อย|ปานกลาง|รุนแรง)/);
  return match?.[1] ?? "";
};

const formatPersonalNonNormalPhrase = (testKey: string, status: string) => {
  if (status === "ไม่ได้รับการตรวจ") return "";

  if (testKey === "BMI") return status;

  if (testKey === "Blood Pressure") return status;

  if (testKey === "Blood Glucose") {
    if (status === "เบาหวาน") return "เป็นเบาหวาน";
    if (status === "เสี่ยงเบาหวาน") return "เสี่ยงเบาหวาน";
    if (status === "ต่ำกว่าปกติ") return "ระดับน้ำตาลในเลือดต่ำกว่าปกติ";
    return `ระดับน้ำตาลในเลือด${status}`;
  }

  if (testKey === "Lipid Profile") {
    const items = extractStatusItems(status);
    const itemText = items.length ? `(${items.join("/")}) ` : "";
    if (status.startsWith("เสี่ยงต่อสุขภาพ")) return `${itemText}เสี่ยงต่อสุขภาพ`.trim();
    if (status.startsWith("เฝ้าระวัง")) return `${itemText}เฝ้าระวัง`.trim();
    return `${itemText}${status}`.trim();
  }

  if (testKey === "Kidney Function") {
    const items = extractStatusItems(status);
    const severity = extractSeverityFromStatus(status);
    const suffix = severity ? `ผิดปกติ${severity}` : "ผิดปกติ";
    if (!items.length) return "ค่าไตผิดปกติ";
    if (items.length === 2 && items.includes("BUN") && items.includes("Creatinine")) {
      return `ค่าไต BUN และ Creatinine ${suffix}`;
    }
    return `ค่าไต ${items.join(" และ ")} ${suffix}`;
  }

  if (testKey === "Liver Function") {
    const items = extractStatusItems(status);
    const severity = extractSeverityFromStatus(status);
    const suffix = severity ? `ผิดปกติ${severity}` : "ผิดปกติ";
    if (!items.length) return "ค่าตับผิดปกติ";
    return `ค่าตับ ${items.join(" ")} ${suffix}`;
  }

  if (testKey === "Uric Acid") {
    if (status === "สูงกว่าปกติ") return "กรดยูริคในเลือดสูงกว่าปกติ";
    if (status === "ต่ำกว่าปกติ") return "กรดยูริคในเลือดต่ำกว่าปกติ";
    return `กรดยูริคในเลือด${status}`;
  }

  return status;
};

const getStatusSeverityScore = (testKey: string, status: string) => {
  if (status === "ปกติ" || status === "ไม่ได้รับการตรวจ" || status === "อื่นๆ") return 0;

  if (testKey === "BMI") {
    if (status === "อ้วนอันตราย") return 3;
    if (status === "อ้วน") return 2;
    if (status === "น้ำหนักเกิน" || status === "ผอม") return 1;
  }

  if (testKey === "Blood Pressure") {
    if (status === "ความดันสูง" || status === "ความดันต่ำ") return 2;
  }

  if (testKey === "Blood Glucose") {
    if (status === "เบาหวาน") return 3;
    if (status === "เสี่ยงเบาหวาน" || status === "ต่ำกว่าปกติ") return 2;
  }

  if (testKey === "Lipid Profile") {
    if (status.startsWith("เสี่ยงต่อสุขภาพ")) return 2;
    if (status.startsWith("เฝ้าระวัง")) return 1;
  }

  if (testKey === "Liver Function" || testKey === "Kidney Function") {
    if (status.includes("ผิดปกติรุนแรง")) return 3;
    if (status.includes("ผิดปกติปานกลาง")) return 2;
    if (status.includes("ผิดปกติเล็กน้อย")) return 1;
    if (status.includes("ผิดปกติ")) return 2;
  }

  if (testKey === "Uric Acid") {
    if (status === "สูงกว่าปกติ" || status === "ต่ำกว่าปกติ") return 1;
  }

  if (status.includes("ผิดปกติ")) return 2;
  return 1;
};

const FACTOR_WEIGHTS: Record<string, number> = {
  "Blood Pressure": 1.4,
  "Blood Glucose": 1.4,
  "Kidney Function": 1.3,
  "Lipid Profile": 1.2,
  "Liver Function": 1.0,
  BMI: 0.8,
  "Uric Acid": 0.4,
};

const PREDICTION_FACTOR_LABEL: Record<string, string> = {
  BMI: "ภาวะน้ำหนักตัว",
  "Blood Pressure": "ความดันโลหิต",
  "Blood Glucose": "ระดับน้ำตาลในเลือด",
  "Lipid Profile": "ไขมันในเลือด",
  "Kidney Function": "การทำงานของไต",
  "Liver Function": "การทำงานของตับ",
  "Uric Acid": "กรดยูริคในเลือด",
};

const buildCountChart = (rows: HealthRow[], key: string, mapper: (value: string) => string) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = normalizeValue(row[key]);
    const label = mapper(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const buildTestChart = (rows: HealthRow[]): TestDatum[] =>
  TEST_COLUMNS.map(({ key, label }) => {
    const tally = { normal: 0, abnormal: 0, notTested: 0, other: 0 };
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(normalizeValue(row[key]));
      tally[bucket] += 1;
    });
    return { name: label, ...tally };
  });

const toGroupId = (key: string) => `group-${key.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
const TEST_STATUS_LABELS: Record<string, string> = {
  normal: "ปกติ",
  abnormal: "ผิดปกติ",
  notTested: "ไม่ได้รับการตรวจ",
  other: "อื่นๆ",
};

export default function RiskReport() {
  const [allRows, setAllRows] = useState<HealthRow[]>([]);
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<number>(1);
  const [year, setYear] = useState<string>("");
  const [yearsForFactory, setYearsForFactory] = useState<string[]>([]);
  const [personalFactoryId, setPersonalFactoryId] = useState<number>(1);
  const [personalEmpId, setPersonalEmpId] = useState<string>("");
  const [personalYear, setPersonalYear] = useState<string>("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const dataAll = await fetchDatasetJson<HealthRow[]>("ALL/all.json", { cache: "no-store" });
        const factoryRows = Array.isArray(dataAll) ? dataAll.filter((row) => matchesFactory(row, factoryId)) : [];

        const years = Array.from(
          new Set(factoryRows.map((row) => getRowYear(row)).filter(Boolean)),
        ).sort((a, b) => Number(a) - Number(b));

        const effectiveYear = years.includes(year) ? year : (years[years.length - 1] ?? "");
        const filtered = effectiveYear
          ? factoryRows.filter((row) => getRowYear(row) === effectiveYear)
          : [];

        if (active) {
          setAllRows(Array.isArray(dataAll) ? dataAll : []);
          setYearsForFactory(years);
          if (effectiveYear !== year) {
            setYear(effectiveYear);
          }
          setRows(filtered);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to load data";
          setError(message);
          setRows([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [factoryId, year]);

  const totals = useMemo(() => {
    return {
      employees: rows.length,
    };
  }, [rows]);

  const bmiData = useMemo(() => buildCountChart(rows, BMI_KEY, categorizeBmi), [rows]);
  const bpData = useMemo(() => buildCountChart(rows, BP_KEY, categorizeBp), [rows]);
  const testData = useMemo(() => buildTestChart(rows), [rows]);
  const personalFactoryRows = useMemo(
    () => allRows.filter((row) => matchesFactory(row, personalFactoryId)),
    [allRows, personalFactoryId],
  );
  const personalPeople = useMemo(() => {
    const map = new Map<string, string>();
    personalFactoryRows.forEach((row) => {
      const empId = normalizeValue(row.SCG_EmpID);
      if (!empId) return;
      const name = normalizeValue(row.Name);
      if (!map.has(empId)) map.set(empId, name);
    });
    return Array.from(map.entries())
      .map(([empId, name]) => ({ empId, name }))
      .sort((a, b) => a.empId.localeCompare(b.empId, "en"));
  }, [personalFactoryRows]);
  const personalYears = useMemo(() => {
    const source = personalEmpId
      ? personalFactoryRows.filter((row) => normalizeValue(row.SCG_EmpID) === personalEmpId)
      : personalFactoryRows;
    return Array.from(new Set(source.map((row) => getRowYear(row)).filter(Boolean))).sort(
      (a, b) => Number(a) - Number(b),
    );
  }, [personalFactoryRows, personalEmpId]);
  useEffect(() => {
    if (!personalPeople.length) {
      setPersonalEmpId("");
      return;
    }
    if (!personalPeople.some((person) => person.empId === personalEmpId)) {
      setPersonalEmpId(personalPeople[0]?.empId ?? "");
    }
  }, [personalPeople, personalEmpId]);
  useEffect(() => {
    if (!personalYears.length) {
      setPersonalYear("");
      return;
    }
    if (!personalYears.includes(personalYear)) {
      setPersonalYear(personalYears[personalYears.length - 1] ?? "");
    }
  }, [personalYears, personalYear]);
  const personalSelectedRow = useMemo(() => {
    if (!personalEmpId || !personalYear) return null;
    return (
      personalFactoryRows.find(
        (row) => normalizeValue(row.SCG_EmpID) === personalEmpId && getRowYear(row) === personalYear,
      ) ?? null
    );
  }, [personalFactoryRows, personalEmpId, personalYear]);
  const personalOverallMedicalText = useMemo(() => {
    if (!personalSelectedRow) return "กรุณาเลือกพนักงานเพื่อดูสรุปผลสุขภาพรายบุคคล";
    const nonNormalDetails: string[] = [];
    let normalCount = 0;

    OVERALL_MEDICAL_TEST_KEYS.forEach((key) => {
      const raw = normalizeValue(personalSelectedRow[key]);
      const status = getPersonalStatusLabel(key, raw, personalSelectedRow.Sex);
      if (status === "ปกติ") {
        normalCount += 1;
      } else if (status === "ไม่ได้รับการตรวจ") {
        return;
      } else {
        const phrase = formatPersonalNonNormalPhrase(key, status);
        if (phrase) nonNormalDetails.push(phrase);
      }
    });

    if (normalCount === OVERALL_MEDICAL_TEST_KEYS.length || nonNormalDetails.length === 0) return "ปกติ";
    return nonNormalDetails.join(" | ");
  }, [personalSelectedRow]);
  const personalRiskPrediction = useMemo(() => {
    if (!personalSelectedRow) {
      return { tier: 0, text: "กรุณาเลือกพนักงานเพื่อดูการคาดการณ์ความเสี่ยงสุขภาพ" };
    }

    let maxScore = 0;
    let weightedSum = 0;
    let systemAbnormalCount = 0;
    const seenSystem = new Set<string>();
    const factorSignals: Array<{ key: string; score: number }> = [];
    OVERALL_MEDICAL_TEST_KEYS.forEach((key) => {
      const raw = normalizeValue(personalSelectedRow[key]);
      const status = getPersonalStatusLabel(key, raw, personalSelectedRow.Sex);
      const score = getStatusSeverityScore(key, status);
      if (score > maxScore) maxScore = score;
      if (score > 0) {
        const weight = FACTOR_WEIGHTS[key] ?? 1;
        weightedSum += score * weight;
        factorSignals.push({ key, score });
        if (
          key === "Blood Pressure" ||
          key === "Blood Glucose" ||
          key === "Kidney Function" ||
          key === "Liver Function" ||
          key === "Lipid Profile"
        ) {
          seenSystem.add(key);
        }
      }
      systemAbnormalCount = seenSystem.size;
    });

    const topFactors = factorSignals
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => PREDICTION_FACTOR_LABEL[item.key] ?? getItemLabel(item.key));
    const factorText = topFactors.length ? ` โดยมีปัจจัยหลักจาก ${topFactors.join(", ")}` : "";

    // Hard overrides first
    if (maxScore >= 3) {
      return {
        tier: 3,
        text: `หากไม่เข้ารับการดูแลทันที อาจเกิดภาวะแทรกซ้อนรุนแรง เช่น โรคหัวใจ หลอดเลือด หรือการเสื่อมของอวัยวะสำคัญ${factorText}`,
      };
    }
    if (systemAbnormalCount >= 2) {
      if (weightedSum >= 4.5) {
        return {
          tier: 3,
          text: `หากไม่เข้ารับการดูแลทันที อาจเกิดภาวะแทรกซ้อนรุนแรง เช่น โรคหัวใจ หลอดเลือด หรือการเสื่อมของอวัยวะสำคัญ${factorText}`,
        };
      }
      return {
        tier: 2,
        text: `หากไม่ติดตามรักษาอย่างต่อเนื่อง มีโอกาสเพิ่มความเสี่ยงโรคเรื้อรังและภาวะแทรกซ้อนของระบบเมตาบอลิก${factorText}`,
      };
    }

    // Weighted thresholds
    if (weightedSum >= 6.5) {
      return {
        tier: 3,
        text: `หากไม่เข้ารับการดูแลทันที อาจเกิดภาวะแทรกซ้อนรุนแรง เช่น โรคหัวใจ หลอดเลือด หรือการเสื่อมของอวัยวะสำคัญ${factorText}`,
      };
    }
    if (weightedSum >= 3.0) {
      return {
        tier: 2,
        text: `หากไม่ติดตามรักษาอย่างต่อเนื่อง มีโอกาสเพิ่มความเสี่ยงโรคเรื้อรังและภาวะแทรกซ้อนของระบบเมตาบอลิก${factorText}`,
      };
    }
    if (weightedSum > 0) {
      return {
        tier: 1,
        text: `หากไม่ปรับพฤติกรรมและติดตามผล อาจพัฒนาไปสู่ภาวะเสี่ยงโรคเรื้อรังในระยะถัดไป${factorText}`,
      };
    }
    return {
      tier: 0,
      text: "ความเสี่ยงรวมอยู่ในระดับต่ำ หากดูแลสุขภาพต่อเนื่องตามปกติ",
    };
  }, [personalSelectedRow]);
  const isPersonalSummaryNormal = personalOverallMedicalText === "ปกติ";
  const personalRiskPredictionText = personalRiskPrediction.text;
  const personalRecommendationText =
    personalRiskPrediction.tier === 3
      ? "ควรพบแพทย์อย่างเร่งด่วน"
      : personalRiskPrediction.tier === 2
        ? "ควรพบแพทย์"
        : personalRiskPrediction.tier === 1
          ? "ควรปรึกษาแพทย์"
          : "ปกติ";
  const groupedItems = useMemo<ItemGroup[]>(() => {
    const known = new Set(GROUPS.flatMap((group) => group.items));
    DEMOGRAPHICS_KEYS.forEach((key) => known.add(key));
    const availableKeys = rows.length ? Object.keys(rows[0]) : [];
    const leftovers = availableKeys.filter((key) => !known.has(key));
    if (!leftovers.length) return GROUPS;
    return [...GROUPS, { key: "Other", title: "อื่นๆ (Other)", items: leftovers }];
  }, [rows]);

  const [activeGroup, setActiveGroup] = useState<string>("Vitals");

  const visibleGroups =
    activeGroup === "All"
      ? groupedItems
      : groupedItems.filter((group) => group.key === activeGroup);



  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 pt-18 pb-8">
        <section className="flex items-center justify-between rounded-2xl border bg-white px-5 py-4">
          <div className="text-sm font-semibold text-gray-700">Factory</div>
          <div className="flex items-center gap-3">
            <select
              className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
              value={factoryId}
              onChange={(event) => setFactoryId(Number(event.target.value))}
            >
              <option value={1}>TS</option>
              <option value={2}>TL</option>
              <option value={3}>KK</option>
              <option value={4}>BS</option>
            </select>
            <select
              className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
              value={year}
              onChange={(event) => setYear(event.target.value)}
            >
              {yearsForFactory.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase">Employees</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "Loadingโ€ฆ" : totals.employees.toLocaleString("en-US")}
            </div>

          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase ">BMI categories</div>
            {loading ? (
              <div className="mt-2 text-sm text-gray-500">Loadingโ€ฆ</div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {bmiData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase ">Blood pressure</div>
            {loading ? (
              <div className="mt-2 text-sm text-gray-500">Loadingโ€ฆ</div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {bpData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-base font-semibold uppercase">Grouped data items</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {groupedItems.map((group) => (
              <button
                key={group.key}
                onClick={() => setActiveGroup(group.key)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold
                  ${activeGroup === group.key
                    ? "border-red-500 text-red-600 bg-red-50"
                    : "border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50"}
                    `}
              >
                {group.title}
              </button>

            ))}
            <button
              onClick={() => setActiveGroup("All")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold
                ${activeGroup === "All"
                  ? "border-red-500 text-red-600 bg-red-50"
                  : "border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50"}
                  `}
            >
              All
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleGroups.map((group) => (
              <div
                key={group.key}
                id={toGroupId(group.key)}
                className="scroll-mt-24 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500">{group.title}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => {
                    const href = ITEM_LINKS[item];

                    return (
                      <span key={item}>
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-gray-400 hover:bg-white"
                          >
                            {getItemLabel(item)}
                          </Link>
                        ) : (
                          <span className="inline-flex rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                            {getItemLabel(item)}
                          </span>
                        )}
                      </span>
                    );
                  })}

                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-gray-700">สัดส่วน BMI</div>
            <div className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loadingโ€ฆ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bmiData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4C7A5A" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-gray-700">ผลตรวจความดันโลหิต</div>
            <div className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loadingโ€ฆ
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bpData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {bpData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-sm font-semibold text-gray-700">สัดส่วนผลความเสี่ยงตามรายการตรวจ</div>
          <div className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Loadingโ€ฆ
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={testData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => [value, TEST_STATUS_LABELS[String(name)] ?? String(name)]} />
                  <Legend formatter={(value) => TEST_STATUS_LABELS[String(value)] ?? String(value)} />
                  <Bar dataKey="normal" name="ปกติ" stackId="status" fill="#4C7A5A" />
                  <Bar dataKey="abnormal" name="ผิดปกติ" stackId="status" fill="#B94A48" />
                  <Bar dataKey="notTested" name="ไม่ได้รับการตรวจ" stackId="status" fill="#B07C2D" />
                  <Bar dataKey="other" name="อื่นๆ" stackId="status" fill="#6B7280" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-base font-semibold text-gray-800">สรุปผลสุขภาพรายบุคคล</div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-gray-600">
              Factory
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={personalFactoryId}
                onChange={(event) => setPersonalFactoryId(Number(event.target.value))}
              >
                <option value={1}>TS</option>
                <option value={2}>TL</option>
                <option value={3}>KK</option>
                <option value={4}>BS</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-600">
              SCG EmpID
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={personalEmpId}
                onChange={(event) => setPersonalEmpId(event.target.value)}
              >
                {!personalPeople.length ? <option value="">ไม่มีข้อมูลพนักงาน</option> : null}
                {personalPeople.map((person) => (
                  <option key={person.empId} value={person.empId}>
                    {person.empId} - {person.name || "ไม่ทราบชื่อ"}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-600">
              Year
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={personalYear}
                onChange={(event) => setPersonalYear(event.target.value)}
              >
                {!personalYears.length ? <option value="">ไม่มีข้อมูลปี</option> : null}
                {personalYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div
              className={`rounded-xl border p-4 text-sm leading-relaxed ${
                isPersonalSummaryNormal
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              <div className="mb-2 font-semibold text-slate-800">สรุปผลจาก 7 ปัจจัย</div>
              {!isPersonalSummaryNormal ? (
                <div className="mb-2 font-semibold">คำแนะนำ: {personalRecommendationText}</div>
              ) : null}
              {personalOverallMedicalText}
            </div>
            <div
              className={`rounded-xl border p-4 ${
                personalRiskPrediction.tier === 0
                  ? "border-emerald-200 bg-emerald-50"
                  : personalRiskPrediction.tier === 3
                    ? "border-red-300 bg-red-50"
                    : personalRiskPrediction.tier === 2
                      ? "border-amber-300 bg-amber-50"
                      : "border-yellow-300 bg-yellow-50"
              }`}
            >
              <div className="text-xs text-slate-600">Health Risk Prediction</div>
              <div
                className={`mt-2 text-base font-semibold leading-relaxed ${
                  personalRiskPrediction.tier === 0
                    ? "text-emerald-700"
                    : personalRiskPrediction.tier === 3
                      ? "text-red-700"
                      : personalRiskPrediction.tier === 2
                        ? "text-amber-700"
                        : "text-yellow-700"
                }`}
              >
                คาดการณ์: {personalRiskPredictionText}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
