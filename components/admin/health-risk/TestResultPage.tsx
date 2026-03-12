"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchDatasetJson } from "@/lib/dataPath";
import { factoryLabelFromRow, matchesFactory } from "@/lib/factory";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

type TestResultPageProps = {
  title: string;
  testKey: string;
  fallbackKeys?: string[];
  backLabel?: string;
};

const TEST_DISPLAY_LABELS: Record<string, string> = {
  "Blood Pressure": "ความดันโลหิต",
  BMI: "ดัชนีมวลกาย (BMI)",
  "Blood Glucose": "ระดับน้ำตาลในเลือด",
  "Liver Function": "ตรวจการทำงานของตับ",
  "Kidney Function": "ตรวจการทำงานของไต",
  "Uric Acid": "ตรวจกรดยูริคในเลือด",
  "Lipid Profile": "ไขมันในเลือด (Lipid Profile)",
  "PSA (Prostate Specific Antigen)": "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด (PSA)",
  "Amphetamine": "ตรวจสารเสพติดในปัสสาวะ",
  "Blood Lead": "ตรวจสารตะกั่วในเลือด (Lead)",
  "Blood Cadmium": "ตรวจสารแคดเมียมในเลือด (Cadmium in Blood)",
  Urinalysis: "ตรวจปัสสาวะ (Urinalysis)",
  CBC: "ตรวจความสมบูรณ์ของเม็ดเลือด (CBC)",
  EKG: "ตรวจคลื่นไฟฟ้าหัวใจ (EKG)",
  "Lung Function": "ตรวจสมรรถภาพปอด",
  "Chest X-ray": "เอกซเรย์ทรวงอก",
  "Stool Exam": "ตรวจอุจจาระ (Stool Examination)",
  "Urine Arsenic": "ตรวจสารหนูในปัสสาวะ (Arsenic in Urine)",
  "Urine Acetone": "ตรวจสารอะซีโตนในปัสสาวะ (Acetone in Urine)",
  "Urine Mercury": "ตรวจสารปรอทในปัสสาวะ (Mercury in Urine)",
  "Urine Toluene": "ตรวจสารโทลูอีนในปัสสาวะ (Toluene)",
  "Urine Xylene": "ตรวจสารไซลีนในปัสสาวะ (Xylene)",
  "Urine Methyl Ethyl Ketone": "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ (Methyl Ethyl Ketone in Urine)",
  "Urine Phenol": "ตรวจสารฟีนอลในปัสสาวะ (Phenol in Urine)",
};
const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getRowYear = (row: HealthRow) =>
  normalizeValue(row.Year ?? row.year ?? row["ปี"] ?? row["year"]);
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const NUMERIC_THRESHOLDS: Record<string, number> = {
  "Blood Lead": 20,
  "Blood Cadmium": 5,
  "Urine Arsenic": 100,
  "Urine Toluene": 1.6,
  "Urine Acetone": 25,
  "Urine Xylene": 1.5,
};

const PIE_COLORS: Record<string, string> = {
  normal: "#16A34A",
  abnormal: "#DC2626",
  high: "#DC2626",
  low: "#F59E0B",
  cholesterolHigh: "#DC2626",
  triglycerideHigh: "#EA580C",
  hdlLow: "#D97706",
  ldlHigh: "#B91C1C",
  sgotAbnormal: "#DC2626",
  sgptAbnormal: "#EA580C",
  alkpAbnormal: "#B91C1C",
  notTested: "#6B7280",
  other: "#94A3B8",
};
const STRONG_RED_DOT = "#FF0000";

const getTestRawValue = (
  row: HealthRow | null,
  key: string,
  fallbackKeys: string[] = [],
) => {
  if (!row) return "";
  const primary = normalizeValue(row[key]);
  if (primary) return primary;
  for (const fallbackKey of fallbackKeys) {
    const fallback = normalizeValue(row[fallbackKey]);
    if (fallback) return fallback;
  }
  return "";
};

const isNotTested = (value: string) => {
  const normalized = value.trim();
  const isDashOnly = /^[\-\u2010-\u2015\u2212]+(\s*,\s*[\-\u2010-\u2015\u2212]+)*$/.test(normalized);

  return (
    normalized === "" ||
    isDashOnly ||
    normalized.includes("ไม่ได้รับการตรวจ") ||
    normalized.includes("ไม่รับการตรวจ") ||
    normalized.includes("ไม่ตรวจ")
  );
};

const parseNumeric = (value: string) => {
  const raw = value.split(",")[0]?.trim() ?? "";
  if (!raw) return null;
  const cleaned = raw.replace("<", "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseLipidParts = (value: string) => {
  const parts = value.split(",").map((part) => part.trim());
  const toNum = (raw: string) => {
    const cleaned = String(raw ?? "").replace("<", "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };
  const tc = toNum(parts[0] ?? "");
  const tg = toNum(parts[1] ?? "");
  const hdl = toNum(parts[2] ?? "");
  const ldl = toNum(parts[3] ?? "");
  const summary = parts.slice(4).join(",").trim();

  const abnormalities: string[] = [];
  if (summary) {
    if (summary.includes("ไขมันคลอเลสเตอรอลสูง")) abnormalities.push("ไขมันคลอเลสเตอรอลสูง");
    if (summary.includes("ไขมันไตรกลีเซอไรด์สูง")) abnormalities.push("ไขมันไตรกลีเซอไรด์สูง");
    if (summary.includes("ไขมัน HDL ต่ำกว่าปกติ")) abnormalities.push("ไขมัน HDL ต่ำกว่าปกติ");
    if (summary.includes("ไขมันตัวร้าย (LDL) สูง")) abnormalities.push("ไขมันตัวร้าย (LDL) สูง");
  }
  if (!abnormalities.length) {
    if (tc !== null && tc >= 200) abnormalities.push("ไขมันคลอเลสเตอรอลสูง");
    if (tg !== null && tg >= 150) abnormalities.push("ไขมันไตรกลีเซอไรด์สูง");
    if (hdl !== null && hdl < 35) abnormalities.push("ไขมัน HDL ต่ำกว่าปกติ");
    if (ldl !== null && ldl >= 150) abnormalities.push("ไขมันตัวร้าย (LDL) สูง");
  }

  return { tc, tg, hdl, ldl, summary, abnormalities };
};

const parseLiverParts = (value: string) => {
  const parts = value.split(",").map((part) => part.trim());
  const toNum = (raw: string) => {
    const cleaned = String(raw ?? "").replace("<", "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };
  const sgot = toNum(parts[0] ?? "");
  const sgpt = toNum(parts[1] ?? "");
  const alkp = toNum(parts[2] ?? "");
  const summary = parts.slice(3).join(",").trim();

  return { sgot, sgpt, alkp, summary };
};

const parseKidneyParts = (value: string) => {
  const parts = value.split(",").map((part) => part.trim());
  const toNum = (raw: string) => {
    const cleaned = String(raw ?? "").replace("<", "").trim();
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };
  const bun = toNum(parts[0] ?? "");
  const creatinine = toNum(parts[1] ?? "");
  const summary = parts.slice(2).join(",").trim();

  return { bun, creatinine, summary };
};

const getCreatinineRange = (sexValue: unknown) => {
  const sexRaw = normalizeValue(sexValue).toLowerCase();
  const isFemale =
    sexRaw.includes("หญิง") ||
    sexRaw === "f" ||
    sexRaw.includes("female");

  return isFemale ? { min: 0.52, max: 1.04 } : { min: 0.66, max: 1.25 };
};

const getBunRange = (sexValue: unknown) => {
  const sexRaw = normalizeValue(sexValue).toLowerCase();
  const isFemale =
    sexRaw.includes("หญิง") ||
    sexRaw === "f" ||
    sexRaw.includes("female");

  return isFemale ? { min: 7, max: 17 } : { min: 9, max: 20 };
};

const isBunAbnormal = (value: number, sexValue: unknown) => {
  const range = getBunRange(sexValue);
  return value < range.min || value > range.max;
};

const isCreatinineAbnormal = (value: number, sexValue: unknown) => {
  const range = getCreatinineRange(sexValue);
  return value < range.min || value > range.max;
};

const compactAxisLabel = (value: unknown, max = 14) => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

const normalizeGroupName = (value: unknown, fallback: string) => {
  const text = normalizeValue(value);
  if (!text || text === "-") return fallback;
  return text;
};

const toNumericValues = (values: Array<number | null | undefined>) =>
  values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));

const getPaddedDomain = (values: number[], referenceValues: number[] = []): [number, number] => {
  const allValues = [...values, ...referenceValues].filter((value) => Number.isFinite(value));
  if (!allValues.length) return [0, 1];
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.4, 2);
    return [Math.max(0, min - pad), max + pad];
  }

  const range = max - min;
  const pad = Math.max(range * 0.4, 2);
  return [Math.max(0, min - pad), max + pad];
};

const integerTick = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Math.round(n));
};

const decimalTick = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
};


const categorizeNormalAbnormal = (value: string, testKey: string, sexValue?: unknown) => {
  if (isNotTested(value)) return "notTested";
  if (testKey === "Blood Pressure") {
    if (value.includes("ความดันโลหิตสูง") || value.includes("สูง")) return "high";
    if (value.includes("ความดันโลหิตต่ำ") || value.includes("ต่ำ")) return "low";
    if (value.includes("ความดันโลหิตปกติ") || value.includes("ปกติ")) return "normal";
    return "other";
  }
  if (testKey === "BMI") {
    const numeric = parseNumeric(value);
    if (numeric === null) return "other";
    if (numeric < 18.5) return "low";
    if (numeric > 22.99) return "high";
    return "normal";
  }
  if (testKey === "Lipid Profile") {
    const { tc, tg, hdl, ldl, summary, abnormalities } = parseLipidParts(value);

    // 1) Prefer explicit summary text when present.
    if (summary) {
      if (abnormalities.includes("ไขมันคลอเลสเตอรอลสูง")) return "cholesterolHigh";
      if (abnormalities.includes("ไขมันไตรกลีเซอไรด์สูง")) return "triglycerideHigh";
      if (abnormalities.includes("ไขมัน HDL ต่ำกว่าปกติ")) return "hdlLow";
      if (abnormalities.includes("ไขมันตัวร้าย (LDL) สูง")) return "ldlHigh";
      if (summary.includes("ปกติ")) return "normal";
    }

    // 2) Fallback to numeric threshold rules.
    const hasAnyNumeric = [tc, tg, hdl, ldl].some((n) => n !== null);
    if (!hasAnyNumeric) return "other";

    if (tc !== null && tc >= 200) return "cholesterolHigh";
    if (tg !== null && tg >= 150) return "triglycerideHigh";
    if (hdl !== null && hdl < 35) return "hdlLow";
    if (ldl !== null && ldl >= 150) return "ldlHigh";
    return "normal";
  }
  if (testKey === "Liver Function") {
    const { sgot, sgpt, alkp, summary } = parseLiverParts(value);
    const hasAnyNumeric = [sgot, sgpt, alkp].some((n) => n !== null);
    if (hasAnyNumeric) {
      if (sgot !== null && (sgot < 15 || sgot > 46)) return "sgotAbnormal";
      if (sgpt !== null && sgpt >= 50) return "sgptAbnormal";
      if (alkp !== null && (alkp < 38 || alkp > 126)) return "alkpAbnormal";
      return "normal";
    }

    const summaryText = summary.replace(/\s+/g, "");
    if (!summaryText) return "other";
    if (summaryText.includes("SGOT")) return "sgotAbnormal";
    if (summaryText.includes("SGPT")) return "sgptAbnormal";
    if (summaryText.includes("ALKP")) return "alkpAbnormal";
    if (summaryText.includes("ปกติ")) return "normal";
    if (summaryText.includes("ผิดปกติ")) return "sgotAbnormal";
    return "other";
  }
  if (testKey === "Kidney Function") {
    const { bun, creatinine, summary } = parseKidneyParts(value);
    const hasAnyNumeric = [bun, creatinine].some((n) => n !== null);
    if (hasAnyNumeric) {
      if (bun !== null && isBunAbnormal(bun, sexValue)) return "bunAbnormal";
      if (creatinine !== null && isCreatinineAbnormal(creatinine, sexValue)) return "creatinineAbnormal";
      return "normal";
    }

    const summaryText = summary.replace(/\s+/g, "");
    if (!summaryText) return "other";
    if (summaryText.includes("ผิดปกติ")) return "bunAbnormal";
    if (summaryText.includes("ปกติ")) return "normal";
    return "other";
  }
  if (testKey === "Urine Mercury") {
    if (
      value.includes("ผลการตรวจสารปรอท อยู่ในเกณฑ์ปกติ") ||
      value.includes("ผลการตรวจสาร Mercury อยู่ในเกณฑ์ปกติ") ||
      value.includes("ไม่เกินค่าอ้างอิง")
    ) {
      return "normal";
    }
  }
  const threshold = NUMERIC_THRESHOLDS[testKey];
  if (threshold !== undefined) {
    const numeric = parseNumeric(value);
    if (numeric === null) return "other";
    return numeric >= threshold ? "abnormal" : "normal";
  }
  if (testKey === "Amphetamine") {
    const lower = value.toLowerCase();
    if (lower.includes("negative") || value.includes("ไม่พบสารแอมเฟตามีน") || value.includes("ตรวจไม่พบสารเสพติด")) {
      return "normal";
    }
    if (lower.includes("positive") || value.includes("ตรวจพบสารเสพติด")) {
      return "abnormal";
    }
  }
  if (testKey === "EKG") {
    const ekgAbnormalHints = [
      "ชีพจรช้า",
      "หัวใจเต้นช้า",
      "หัวใจเต้นผิดจังหวะ",
      "เต้นผิดจังหวะ",
      "สัญญาณติดขัด",
      "การนำกระแสไฟฟ้าหัวใจติดขัด",
      "ปิดกั้นกระแสไฟฟ้าหัวใจ",
      "ปิดกั้นไฟฟ้าหัวใจ",
      "IRBBB",
      "CRBBB",
      "หัวใจโต",
      "หัวใจห้องล่างซ้ายโต",
      "LVH",
      "กล้ามเนื้อหัวใจขาดเลือด",
      "เส้นเลือดหัวใจ",
      "แกนหัวใจเอียง",
      "ไม่สามารถแปลผลได้",
      "ผิดปกติ",
    ];
    if (ekgAbnormalHints.some((hint) => value.includes(hint))) {
      return "abnormal";
    }
    if (value.includes("ปกติ")) return "normal";
  }
  if (testKey === "Chest X-ray") {
    const chestAbnormalHints = [
      "สงสัย",
      "พบ",
      "หัวใจโต",
      "ติดเชื้อ",
      "พังผืด",
      "ก้อน",
      "จุดในปอด",
      "ฝ้าขาว",
      "เยื่อหุ้มปอด",
      "หลอดลมเอียง",
      "ร่องรอยวัณโรค",
      "แนะนำพบแพทย์",
      "กระดูกสันหลังคด",
      "หักเก่า",
      "กระบังลม",
      "หนาตัว",
      "อักเสบ",
      "น้ำในเยื่อหุ้มปอด",
    ];
    if (chestAbnormalHints.some((hint) => value.includes(hint))) {
      return "abnormal";
    }
    if (value.includes("ปกติ")) return "normal";
  }
  if (testKey === "Stool Exam") {
    if (value.includes("ปกติ")) return "normal";
    return "abnormal";
  }
  if (value.includes("ไม่เกินค่าอ้างอิง")) return "normal";
  if (value.includes("เกินค่าอ้างอิง")) return "abnormal";
  if (value.includes("สูงกว่าปกติ")) return "abnormal";
  if (value.includes("ต่ำกว่าปกติ")) return "abnormal";
  if (value.includes("ผิดปกติ")) return "abnormal";
  if (value.includes("ปกติ")) return "normal";
  return "other";
};

const categoryLabel = (bucket: string) => {
  switch (bucket) {
    case "normal":
      return "ปกติ";
    case "high":
      return "ความดันสูง";
    case "low":
      return "ความดันต่ำ";
    case "abnormal":
      return "ผิดปกติ";
    case "cholesterolHigh":
      return "ไขมันคลอเลสเตอรอลสูง";
    case "triglycerideHigh":
      return "ไขมันไตรกลีเซอไรด์สูง";
    case "hdlLow":
      return "ไขมัน HDL ต่ำกว่าปกติ";
    case "ldlHigh":
      return "ไขมันตัวร้าย (LDL) สูง";
    case "sgotAbnormal":
      return "SGOT ผิดปกติ";
    case "sgptAbnormal":
      return "SGPT ผิดปกติ";
    case "alkpAbnormal":
      return "ALKP ผิดปกติ";
    case "bunAbnormal":
      return "BUN ผิดปกติ";
    case "creatinineAbnormal":
      return "Creatinine ผิดปกติ";
    case "notTested":
      return "ไม่ได้รับการตรวจ";
    default:
      return "อื่นๆ";
  }
};

const categoryLabelFromValue = (value: string, bucket: string, testKey?: string) => {
  if (testKey === "Stool Exam") {
    if (bucket === "normal") return "ปกติ";
    if (bucket === "notTested") return "ไม่ได้รับการตรวจ";
    if (bucket === "abnormal") return "ผิดปกติ";
    return categoryLabel(bucket);
  }
  if (testKey === "Lipid Profile") {
    const { abnormalities, summary } = parseLipidParts(value);
    if (abnormalities.length) return abnormalities.join(" - ");
    if (summary.includes("ปกติ")) return "ปกติ";
  }
  if (bucket === "high" && value.includes("ความดัน")) return "ความดันโลหิตสูง";
  if (bucket === "low" && value.includes("ความดัน")) return "ความดันโลหิตต่ำ";
  if (bucket === "high") return "สูงกว่าเกณฑ์ปกติ";
  if (bucket === "low") return "ต่ำกว่าเกณฑ์ปกติ";
  if (bucket === "abnormal") {
    if (value.includes("ความดันโลหิตสูง")) return "ความดันโลหิตสูง";
    if (value.includes("ความดันโลหิตต่ำ")) return "ความดันโลหิตต่ำ";
    if (value.includes("สูงกว่าปกติ")) return "สูงกว่าปกติ";
    if (value.includes("ต่ำกว่าปกติ")) return "ต่ำกว่าปกติ";
  }
  if (bucket === "cholesterolHigh") return "ไขมันคลอเลสเตอรอลสูง";
  if (bucket === "triglycerideHigh") return "ไขมันไตรกลีเซอไรด์สูง";
  if (bucket === "hdlLow") return "ไขมัน HDL ต่ำกว่าปกติ";
  if (bucket === "ldlHigh") return "ไขมันตัวร้าย (LDL) สูง";
  if (bucket === "sgotAbnormal") return "SGOT ผิดปกติ";
  if (bucket === "sgptAbnormal") return "SGPT ผิดปกติ";
  if (bucket === "alkpAbnormal") return "ALKP ผิดปกติ";
  if (bucket === "bunAbnormal") return "BUN ผิดปกติ";
  if (bucket === "creatinineAbnormal") return "Creatinine ผิดปกติ";
  return categoryLabel(bucket);
};


const legendLabelFormatter = (value: string, isLipid: boolean, isLiver: boolean, isKidney: boolean) => {
  if (isLipid) {
    return value;
  }
  if (isLiver) {
    if (value === "SGOT ผิดปกติ") return "SGOT";
    if (value === "SGPT ผิดปกติ") return "SGPT";
    if (value === "ALKP ผิดปกติ") return "ALKP";
    if (value === "ไม่ได้รับการตรวจ") return "ไม่ตรวจ";
  }
  if (isKidney) {
    if (value === "BUN ผิดปกติ") return "BUN";
    if (value === "Creatinine ผิดปกติ") return "Creatinine";
    if (value === "ไม่ได้รับการตรวจ") return "ไม่ตรวจ";
  }
  return value;
};

const trendValue = (value: string, testKey: string) => {
  if (testKey === "Blood Pressure") {
    const bucket = categorizeNormalAbnormal(value, testKey);
    if (bucket === "low") return 0.2;
    if (bucket === "normal") return 0.6;
    if (bucket === "high") return 1;
    return null;
  }
  if (testKey === "Blood Glucose" || testKey === "BMI") {
    const numeric = parseNumeric(value);
    return numeric ?? null;
  }
  const bucket = categorizeNormalAbnormal(value, testKey);
  if (bucket === "normal") return 0.6;
  if (
    bucket === "abnormal" ||
    bucket === "cholesterolHigh" ||
    bucket === "triglycerideHigh" ||
    bucket === "hdlLow" ||
    bucket === "ldlHigh" ||
    bucket === "sgotAbnormal" ||
    bucket === "sgptAbnormal" ||
    bucket === "alkpAbnormal"
  ) {
    return 1;
  }
  return null;
};

const getDisplayValue = (value: string, testKey: string) => {
  if (!value) return "-";
  const numeric = parseNumeric(value);
  if (numeric !== null && value.includes(",")) {
    return numeric.toString();
  }
  if (numeric !== null && NUMERIC_THRESHOLDS[testKey] !== undefined) {
    return numeric.toString();
  }
  return value;
};

const getResultNumberDisplay = (value: string, testKey: string) => {
  if (testKey === "EKG") {
    return value.trim() || "-";
  }
  if (testKey === "Lung Function") {
    const firstPart = value.split(",")[0]?.trim() ?? "";
    return firstPart || "-";
  }
  if (testKey === "Chest X-ray") {
    const firstPart = value.split(",")[0]?.trim() ?? "";
    return firstPart || "-";
  }
  if (testKey === "Stool Exam") {
    if (isNotTested(value)) return "-";
    if (value.includes("ปกติ")) return "ปกติ";
    return value.trim() ? "ผิดปกติ" : "-";
  }
  if (testKey === "Amphetamine") {
    const lower = value.toLowerCase();
    if (lower.includes("positive") || value.includes("ตรวจพบสารเสพติด")) return "Positive";
    if (lower.includes("negative") || value.includes("ไม่พบสารแอมเฟตามีน") || value.includes("ตรวจไม่พบสารเสพติด")) {
      return "Negative";
    }
    return value.trim() || "-";
  }
  if (testKey === "Blood Pressure") {
    const bpMatch = value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
    if (bpMatch) {
      return `${bpMatch[1]}/${bpMatch[2]}`;
    }
    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }
  if (testKey === "Lipid Profile") {
    const parts = value.split(",").map((part) => part.trim());
    const numbers = parts.slice(0, 4).filter(Boolean);
    return numbers.length ? numbers.join(",") : "-";
  }
  const numeric = parseNumeric(value);
  return numeric === null ? "-" : numeric.toString();
};

const parseBloodPressureValues = (value: string) => {
  const slash = value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (slash) return { sys: slash[1], dia: slash[2] };

  const commaParts = value
    .split(",")
    .map((part) => part.trim())
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n));

  if (commaParts.length >= 2) {
    return { sys: String(Math.round(commaParts[0])), dia: String(Math.round(commaParts[1])) };
  }

  return null;
};

type TrendTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { raw?: string; value?: number | null; bucket?: string } }>;
  testKey: string;
};

const TrendTooltip = ({ active, payload, testKey }: TrendTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  const textColor =
    point.bucket === "abnormal" ||
    point.bucket === "cholesterolHigh" ||
    point.bucket === "triglycerideHigh" ||
    point.bucket === "hdlLow" ||
    point.bucket === "ldlHigh" ||
    point.bucket === "sgotAbnormal" ||
    point.bucket === "sgptAbnormal" ||
    point.bucket === "alkpAbnormal"
      ? "text-red-700"
      : point.bucket === "normal"
        ? "text-emerald-700"
        : "text-gray-700";

  const shownValue =
    testKey === "Blood Glucose"
      ? point.value ?? "-"
      : getDisplayValue(point.raw ?? "", testKey);

  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className={`font-semibold ${textColor}`}>
        {shownValue} {categoryLabelFromValue(point.raw ?? "", point.bucket ?? "other", testKey)}
      </div>
    </div>
  );
};

const renderValueDotWithLabel = ({
  cx,
  cy,
  fill,
  label,
  radius = 6,
}: {
  cx?: number;
  cy?: number;
  fill: string;
  label: string;
  radius?: number;
}) => {
  if (typeof cx !== "number" || typeof cy !== "number" || !label) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill={fill} stroke="#FFFFFF" strokeWidth={2} />
      <text x={cx + 8} y={cy - 8} fontSize={11} fill={fill}>
        {label}
      </text>
    </g>
  );
};

const REFERENCE_LINE_STYLE = {
  stroke: "#9CA3AF",
  strokeDasharray: "4 4",
  strokeWidth: 1,
};

const referenceLineLabel = (value: string) => ({
  value,
  position: "right" as const,
  fill: "#9CA3AF",
  fontSize: 10,
});

export default function TestResultPage({
  title,
  testKey,
  fallbackKeys = [],
  backLabel = "Health Risk",
}: TestResultPageProps) {
  const displayTitle = TEST_DISPLAY_LABELS[testKey] ?? title;
  const isBloodPressure = testKey === "Blood Pressure";
  const isBMI = testKey === "BMI";
  const isLipid = testKey === "Lipid Profile";
  const isLiver = testKey === "Liver Function";
  const isKidney = testKey === "Kidney Function";
  const isArsenicTest =
    testKey.toLowerCase().includes("arsenic") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("arsenic") || key.includes("สารหนู"));
  const isAcetoneTest =
    testKey.toLowerCase().includes("acetone") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("acetone") || key.includes("อะซิโตน"));
  const isMercuryTest =
    testKey.toLowerCase().includes("mercury") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("mercury") || key.includes("ปรอท"));
  const isTolueneTest =
    testKey.toLowerCase().includes("toluene") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("toluene") || key.includes("โทลูอีน"));
  const isXyleneTest =
    testKey.toLowerCase().includes("xylene") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("xylene") || key.includes("ไซลีน"));
  const isMethylEthylKetoneTest =
    testKey.toLowerCase().includes("methyl ethyl ketone") ||
    fallbackKeys.some(
      (key) => key.toLowerCase().includes("methyl ethyl ketone") || key.includes("เมทิล เอทิล คีโตน"),
    );
  const isPhenolTest =
    testKey.toLowerCase().includes("phenol") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("phenol") || key.includes("ฟีนอล"));
  const isLeadTest =
    testKey.toLowerCase().includes("lead") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("lead") || key.includes("สารตะกั่ว"));
  const isCadmiumTest =
    testKey.toLowerCase().includes("cadmium") ||
    fallbackKeys.some((key) => key.toLowerCase().includes("cadmium") || key.includes("แคดเมียม"));
  const isHighlightedToxicTest = isArsenicTest || isAcetoneTest;
  const showPieSliceLabel = !isLipid;
  const categorySeries = isBloodPressure
    ? [
        { key: "normal", name: "ปกติ" },
        { key: "high", name: "ความดันสูง" },
        { key: "low", name: "ความดันต่ำ" },
        { key: "notTested", name: "ไม่ได้รับการตรวจ" },
        { key: "other", name: "อื่นๆ" },
      ]
    : isBMI
      ? [
          { key: "normal", name: "ปกติ" },
          { key: "high", name: "สูงกว่าเกณฑ์ปกติ" },
          { key: "low", name: "ต่ำกว่าเกณฑ์ปกติ" },
          { key: "notTested", name: "ไม่ได้รับการตรวจ" },
          { key: "other", name: "อื่นๆ" },
        ]
    : isLipid
      ? [
          { key: "normal", name: "ปกติ" },
          { key: "cholesterolHigh", name: "คลอเลสเตอรอลสูง" },
          { key: "ldlHigh", name: "LDL สูง" },
          { key: "hdlLow", name: "HDLต่ำ" },
          { key: "triglycerideHigh", name: "ไตรกลีเซอไรด์สูง" },
          { key: "notTested", name: "ไม่ได้รับการตรวจ" },
        ]
    : isLiver
        ? [
            { key: "normal", name: "ปกติ" },
            { key: "sgotAbnormal", name: "SGOT ผิดปกติ" },
            { key: "sgptAbnormal", name: "SGPT ผิดปกติ" },
            { key: "alkpAbnormal", name: "ALKP ผิดปกติ" },
            { key: "notTested", name: "ไม่ได้รับการตรวจ" },
            { key: "other", name: "อื่นๆ" },
          ]
        : isKidney
          ? [
              { key: "normal", name: "ปกติ" },
              { key: "bunAbnormal", name: "BUN ผิดปกติ" },
              { key: "creatinineAbnormal", name: "Creatinine ผิดปกติ" },
              { key: "notTested", name: "ไม่ได้รับการตรวจ" },
              { key: "other", name: "อื่นๆ" },
            ]
      : [
        { key: "normal", name: "ปกติ" },
        { key: "abnormal", name: "ผิดปกติ" },
        { key: "notTested", name: "ไม่ได้รับการตรวจ" },
        { key: "other", name: "อื่นๆ" },
      ];

  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [overviewRowsByYear, setOverviewRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<number>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [overviewYear, setOverviewYear] = useState("");
  const [selectedYearTouched, setSelectedYearTouched] = useState(false);
  const [overviewYearTouched, setOverviewYearTouched] = useState(false);
  const [overviewFactory, setOverviewFactory] = useState("");
  const [overviewDepartment, setOverviewDepartment] = useState("");
  const [overviewSection, setOverviewSection] = useState("");
  const [overviewDepartmentSearch, setOverviewDepartmentSearch] = useState("");
  const [overviewSectionSearch, setOverviewSectionSearch] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const dataAll = await fetchDatasetJson<HealthRow[]>("ALL/all.json", { cache: "no-store" });
        const allRows = Array.isArray(dataAll) ? dataAll : [];
        const filtered = allRows.filter((row) => matchesFactory(row, factoryId));

        const years = Array.from(
          new Set(filtered.map((row) => getRowYear(row)).filter(Boolean)),
        ).sort((a, b) => Number(a) - Number(b));
        const allYears = Array.from(
          new Set(allRows.map((row) => getRowYear(row)).filter(Boolean)),
        ).sort((a, b) => Number(a) - Number(b));

        const nextRowsByYear = years.reduce<Record<string, HealthRow[]>>((acc, year) => {
          acc[year] = filtered.filter((row) => getRowYear(row) === year);
          return acc;
        }, {});
        const nextOverviewRowsByYear = allYears.reduce<Record<string, HealthRow[]>>((acc, year) => {
          acc[year] = allRows.filter((row) => getRowYear(row) === year);
          return acc;
        }, {});

        const yearsWithTestData = years.filter((year) =>
          (nextRowsByYear[year] ?? []).some((row) => {
            const raw = normalizeValue(getTestRawValue(row, testKey, fallbackKeys));
            return raw !== "" && raw.toLowerCase() !== "null";
          }),
        );

        if (active) {
          setAvailableYears(yearsWithTestData.length ? yearsWithTestData : years);
          setRowsByYear(nextRowsByYear);
          setOverviewRowsByYear(nextOverviewRowsByYear);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to load data";
          setError(message);
          setRowsByYear({});
          setOverviewRowsByYear({});
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [factoryId]);

  useEffect(() => {
    setSelectedEmpId("");
    setSelectedYearTouched(false);
  }, [factoryId]);

  useEffect(() => {
    setOverviewFactory("");
    setOverviewDepartment("");
    setOverviewSection("");
    setOverviewDepartmentSearch("");
    setOverviewSectionSearch("");
  }, [overviewYear]);

  useEffect(() => {
    setOverviewDepartment("");
    setOverviewSection("");
    setOverviewDepartmentSearch("");
    setOverviewSectionSearch("");
  }, [overviewFactory]);

  useEffect(() => {
    setOverviewSection("");
    setOverviewSectionSearch("");
  }, [overviewDepartment]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedYear("");
      return;
    }

    const latestYear = availableYears[availableYears.length - 1] ?? "";
    if (!selectedYearTouched || !availableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [availableYears, selectedYear, selectedYearTouched]);

  

  const individualYears = availableYears;

  const overviewAvailableYears = useMemo(() => {
    const years = Object.keys(overviewRowsByYear).sort((a, b) => Number(a) - Number(b));
    return years.filter((year) =>
      (overviewRowsByYear[year] ?? []).some((row) => {
        if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
        const raw = normalizeValue(getTestRawValue(row, testKey, fallbackKeys));
        return raw !== "" && raw !== "-" && raw.toLowerCase() !== "null";
      }),
    );
  }, [overviewRowsByYear, overviewFactory, testKey, fallbackKeys]);

  useEffect(() => {
    if (!overviewAvailableYears.length) {
      setOverviewYear("");
      return;
    }
    const latestYear = overviewAvailableYears[overviewAvailableYears.length - 1] ?? "";
    if (!overviewYearTouched || !overviewAvailableYears.includes(overviewYear)) {
      setOverviewYear(latestYear);
    }
  }, [overviewAvailableYears, overviewYear, overviewYearTouched]);

  const people = useMemo(() => {
    const merged = new Map<string, { empId: string; name: string; department: string; section: string }>();
    individualYears.forEach((year) => {
      (rowsByYear[year] ?? []).forEach((row) => {
        const empId = normalizeValue(row.SCG_EmpID);
        if (!empId) return;
        if (!merged.has(empId)) {
          merged.set(empId, {
            empId,
            name: normalizeValue(row.Name),
            department: normalizeValue(row.Department),
            section: normalizeValue(row.Section),
          });
        }
      });
    });
    return Array.from(merged.values());
  }, [rowsByYear, individualYears]);

  const highlightedAbnormalEmpIds = useMemo(() => {
    const set = new Set<string>();
    if (!isHighlightedToxicTest) return set;
    individualYears.forEach((year) => {
      (rowsByYear[year] ?? []).forEach((row) => {
        const empId = normalizeValue(row.SCG_EmpID);
        if (!empId) return;
        const raw = getTestRawValue(row, testKey, fallbackKeys);
        const bucket = categorizeNormalAbnormal(raw, testKey, row.Sex);
        const isAbnormalBucket = bucket !== "normal" && bucket !== "notTested" && bucket !== "other";
        if (isAbnormalBucket) {
          set.add(empId);
        }
      });
    });
    return set;
  }, [isHighlightedToxicTest, individualYears, rowsByYear, testKey, fallbackKeys]);

  const phenolThreeYearEmpIds = useMemo(() => {
    const set = new Set<string>();
    if (!isPhenolTest) return set;
    const yearsByEmp = new Map<string, Set<string>>();
    individualYears.forEach((year) => {
      (rowsByYear[year] ?? []).forEach((row) => {
        const empId = normalizeValue(row.SCG_EmpID);
        if (!empId) return;
        const raw = normalizeValue(getTestRawValue(row, testKey, fallbackKeys));
        const hasMeaningfulValue =
          raw !== "" && raw !== "-" && raw.toLowerCase() !== "null" && !isNotTested(raw);
        if (!hasMeaningfulValue) return;
        if (!yearsByEmp.has(empId)) yearsByEmp.set(empId, new Set<string>());
        yearsByEmp.get(empId)!.add(year);
      });
    });
    yearsByEmp.forEach((years, empId) => {
      if (years.size >= 3) set.add(empId);
    });
    return set;
  }, [isPhenolTest, individualYears, rowsByYear, testKey, fallbackKeys]);

  const selectedEmpAvailableYears = useMemo(() => {
    if (!selectedEmpId) return individualYears;
    return individualYears.filter((year) =>
      (rowsByYear[year] ?? []).some((row) => normalizeValue(row.SCG_EmpID) === selectedEmpId),
    );
  }, [individualYears, rowsByYear, selectedEmpId]);

  const selectedPerson = useMemo(() => {
    if (!selectedEmpId) return null;
    return (
      rowsByYear[selectedYear]?.find((row) => normalizeValue(row.SCG_EmpID) === selectedEmpId) ??
      null
    );
  }, [rowsByYear, selectedEmpId, selectedYear]);

  useEffect(() => {
    if (!selectedEmpId || !selectedEmpAvailableYears.length) return;
    const latestYear = selectedEmpAvailableYears[selectedEmpAvailableYears.length - 1];
    if (!selectedYearTouched || !selectedEmpAvailableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [selectedEmpId, selectedEmpAvailableYears, selectedYear, selectedYearTouched]);

  const selectedResult = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear[selectedYear]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = getTestRawValue(row, testKey, fallbackKeys);
    const bucket = categorizeNormalAbnormal(raw, testKey, selectedPerson?.Sex);
    return { raw, bucket };
  }, [rowsByYear, selectedEmpId, selectedYear, testKey, fallbackKeys]);

  const resultDisplay = selectedResult ? getResultNumberDisplay(selectedResult.raw, testKey) : "-";
  const hasBloodPressureNumeric = selectedResult
    ? /(\d{2,3})\s*\/\s*(\d{2,3})/.test(selectedResult.raw)
    : false;
  const showResultCard =
    !isBloodPressure &&
    (testKey !== "Blood Pressure" || hasBloodPressureNumeric) &&
    testKey !== "Lipid Profile" &&
    !isLiver &&
    !isKidney &&
    resultDisplay !== "-";
  const bpValues = selectedResult ? parseBloodPressureValues(selectedResult.raw) : null;
  const bpSysValue = bpValues?.sys ?? "-";
  const bpDiaValue = bpValues?.dia ?? "-";
  const trend = useMemo(() => {
    if (!selectedEmpId) return [];
    return individualYears.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const raw = getTestRawValue(row ?? null, testKey, fallbackKeys);
      const bucket = categorizeNormalAbnormal(raw, testKey, selectedPerson?.Sex);
      const rawNumeric = parseNumeric(raw);
      const useRawNumericTrend =
        !isBloodPressure &&
        !isLipid &&
        !isLiver &&
        !isKidney &&
        raw.includes(",") &&
        rawNumeric !== null;
      const value = useRawNumericTrend ? rawNumeric : trendValue(raw, testKey);
      return {
        year,
        raw,
        value,
        bucket,
        normalValue: bucket === "normal" ? value : null,
        abnormalValue: bucket === "abnormal" ? value : null,
      };
    });
  }, [rowsByYear, selectedEmpId, testKey, fallbackKeys, individualYears, isBloodPressure, isLipid, isLiver, isKidney, selectedPerson?.Sex]);

  const lipidTrend = useMemo(() => {
    if (!isLipid || !selectedEmpId) return null;
    const buildMetric = (
      key: "tc" | "tg" | "hdl" | "ldl",
      label: string,
      isAbnormal: (value: number) => boolean,
    ) => {
      const data = individualYears.map((year) => {
        const row =
          rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
          null;
        const raw = getTestRawValue(row ?? null, testKey, fallbackKeys);
        const lipid = parseLipidParts(raw);
        const value = lipid[key];
        const abnormal = value !== null ? isAbnormal(value) : null;
        return { year, value, abnormal };
      });
      return { key, label, data };
    };

    return [
      buildMetric("tc", "Total Cholesterol", (v) => v >= 200),
      buildMetric("tg", "Triglyceride", (v) => v >= 150),
      buildMetric("hdl", "HDL", (v) => v < 35),
      buildMetric("ldl", "LDL", (v) => v >= 150),
    ];
  }, [isLipid, selectedEmpId, individualYears, rowsByYear, testKey, fallbackKeys]);

  const liverTrend = useMemo(() => {
    if (!isLiver || !selectedEmpId) return null;
    const sexRaw = normalizeValue(selectedPerson?.Sex).toLowerCase();
    const isFemale = sexRaw.includes("หญิง") || sexRaw === "f" || sexRaw.includes("female");
    const sgptUpper = isFemale ? 35 : 50;
    const buildMetric = (
      key: "sgot" | "sgpt" | "alkp",
      label: string,
      isAbnormal: (value: number) => boolean,
    ) => {
      const data = individualYears.map((year) => {
        const row =
          rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
          null;
        const raw = getTestRawValue(row ?? null, testKey, fallbackKeys);
        const liver = parseLiverParts(raw);
        const value = liver[key];
        const abnormal = value !== null ? isAbnormal(value) : null;
        return { year, value, abnormal };
      });
      return { key, label, data };
    };

    return [
      buildMetric("sgot", "SGOT", (v) => v < 15 || v > 46),
      buildMetric("sgpt", "SGPT", (v) => v >= sgptUpper),
      buildMetric("alkp", "ALKP", (v) => v < 38 || v > 126),
    ];
  }, [isLiver, selectedEmpId, selectedPerson?.Sex, individualYears, rowsByYear, testKey, fallbackKeys]);

  const kidneyTrend = useMemo(() => {
    if (!isKidney || !selectedEmpId) return null;
    const buildMetric = (key: "bun" | "creatinine", label: string) => {
      const data = individualYears.map((year) => {
        const row =
          rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
          null;
        const raw = getTestRawValue(row ?? null, testKey, fallbackKeys);
        const kidney = parseKidneyParts(raw);
        const metricValue = kidney[key];
        const abnormal =
          metricValue === null
            ? null
            : key === "bun"
              ? isBunAbnormal(metricValue, selectedPerson?.Sex)
              : isCreatinineAbnormal(metricValue, selectedPerson?.Sex);
        return {
          year,
          value: metricValue,
          abnormal,
        };
      });
      return { key, label, data };
    };

    return [
      buildMetric("bun", "BUN"),
      buildMetric("creatinine", "Creatinine"),
    ];
  }, [isKidney, selectedEmpId, individualYears, rowsByYear, testKey, fallbackKeys, selectedPerson?.Sex]);

  const overviewRowsYear = useMemo(
    () => overviewRowsByYear[overviewYear] ?? [],
    [overviewRowsByYear, overviewYear],
  );

  const overviewDepartmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? matchesFactory(row, Number(overviewFactory)) : true))
          .map((row) => normalizeValue(row.Department))
          .filter((value) => value && value !== "-"),
      ),
    )
      .sort((a, b) => a.localeCompare(b))
      .filter((department) =>
        overviewDepartmentSearch
          ? department.toLowerCase().includes(overviewDepartmentSearch.trim().toLowerCase())
          : true,
      );
  }, [overviewRowsYear, overviewFactory, overviewDepartmentSearch]);

  const overviewSectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? matchesFactory(row, Number(overviewFactory)) : true))
          .filter((row) =>
            overviewDepartment ? normalizeValue(row.Department) === overviewDepartment : true,
          )
          .map((row) => normalizeValue(row.Section))
          .filter((value) => value && value !== "-"),
      ),
    )
      .sort((a, b) => a.localeCompare(b))
      .filter((section) =>
        overviewSectionSearch
          ? section.toLowerCase().includes(overviewSectionSearch.trim().toLowerCase())
          : true,
      );
  }, [overviewRowsYear, overviewFactory, overviewDepartment, overviewSectionSearch]);

  const overviewRows = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
      const department = normalizeValue(row.Department);
      const section = normalizeValue(row.Section);
      if (overviewDepartment && department !== overviewDepartment) return false;
      if (overviewSection && section !== overviewSection) return false;
      return true;
    });
  }, [overviewRowsYear, overviewFactory, overviewDepartment, overviewSection]);

  const overviewRowsForDepartmentChart = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
      const department = normalizeValue(row.Department);
      if (overviewDepartment && department !== overviewDepartment) return false;
      return true;
    });
  }, [overviewRowsYear, overviewFactory, overviewDepartment]);

  const overviewRowsForFactoryChart = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
      return true;
    });
  }, [overviewRowsYear, overviewFactory]);

  const summaryOverview = useMemo(() => {
    const rows = overviewRows;
    const counts = Object.fromEntries(categorySeries.map((item) => [item.key, 0])) as Record<string, number>;
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(
        getTestRawValue(row, testKey, fallbackKeys),
        testKey,
        row.Sex,
      );
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [overviewRows, testKey, fallbackKeys, categorySeries]);

  const summaryDepartmentOverview = useMemo(() => {
    const rows = overviewRowsForDepartmentChart;
    const counts = Object.fromEntries(categorySeries.map((item) => [item.key, 0])) as Record<string, number>;
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(
        getTestRawValue(row, testKey, fallbackKeys),
        testKey,
        row.Sex,
      );
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [overviewRowsForDepartmentChart, testKey, fallbackKeys, categorySeries]);

  const overviewPieData = useMemo(
    () =>
      categorySeries
        .map((item) => ({ key: item.key, name: item.name, value: summaryOverview[item.key] ?? 0 }))
        .filter((item) => item.value > 0),
    [summaryOverview, categorySeries],
  );

  const overviewDepartmentPieData = useMemo(
    () =>
      categorySeries
        .map((item) => ({ key: item.key, name: item.name, value: summaryDepartmentOverview[item.key] ?? 0 }))
        .filter((item) => item.value > 0),
    [summaryDepartmentOverview, categorySeries],
  );

  const isNumericTrend =
    testKey === "Blood Glucose" ||
    testKey === "BMI" ||
    (!isBloodPressure &&
      !isLipid &&
      !isLiver &&
      !isKidney &&
      trend.some((point) => {
        const raw = String(point.raw ?? "");
        return raw.includes(",") && parseNumeric(raw) !== null;
      }));

  const numericReferenceValues = useMemo(() => {
    if (testKey === "BMI") return [18.5, 22.99];
    if (testKey === "Blood Glucose") return [70, 99];
    if (isArsenicTest) return [100];
    if (isAcetoneTest) return [25];
    if (isMercuryTest) return [20];
    if (isTolueneTest) return [0.03];
    if (isXyleneTest) return [0.3];
    if (isMethylEthylKetoneTest) return [2];
    if (isPhenolTest) return [250];
    if (isLeadTest) return [20];
    if (isCadmiumTest) return [5];
    return [];
  }, [testKey, isArsenicTest, isAcetoneTest, isMercuryTest, isTolueneTest, isXyleneTest, isMethylEthylKetoneTest, isPhenolTest, isLeadTest, isCadmiumTest]);

  const tolueneTrendDomain = useMemo<[number, number] | undefined>(() => {
    if (!isTolueneTest) return undefined;
    const values = toNumericValues(trend.map((p) => p.value));
    const all = [...values, 0.03].filter((v) => Number.isFinite(v));
    if (!all.length) return [0, 0.04];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = Math.max(max - min, 0.02);
    const pad = span * 0.2;
    const lower = Math.max(0, min - pad);
    const upper = max + pad;
    return [lower, upper];
  }, [isTolueneTest, trend]);

  const xyleneTrendDomain = useMemo<[number, number] | undefined>(() => {
    if (!isXyleneTest) return undefined;
    const values = toNumericValues(trend.map((p) => p.value));
    const all = [...values, 0.3].filter((v) => Number.isFinite(v));
    if (!all.length) return [0, 0.36];
    const min = Math.min(...all);
    const max = Math.max(...all);
    const span = Math.max(max - min, 0.12);
    const pad = span * 0.2;
    const lower = Math.max(0, min - pad);
    const upper = max + pad;
    return [lower, upper];
  }, [isXyleneTest, trend]);

  const buildGroupChart = (
    groupKey: "Factory" | "Department" | "Section",
    rows: HealthRow[],
  ) => {
    const grouped = new Map<string, Record<string, number>>();
    rows.forEach((row) => {
      const groupName =
        groupKey === "Factory"
          ? factoryLabelFromRow(row)
          : normalizeGroupName(row[groupKey], groupKey === "Section" ? "ไม่ระบุ Section" : "ไม่ระบุ Department");
      const bucket = categorizeNormalAbnormal(
        getTestRawValue(row, testKey, fallbackKeys),
        testKey,
        row.Sex,
      );
      if (!grouped.has(groupName)) {
        grouped.set(
          groupName,
          Object.fromEntries(categorySeries.map((item) => [item.key, 0])) as Record<string, number>,
        );
      }
      const current = grouped.get(groupName)!;
      current[bucket] = (current[bucket] ?? 0) + 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => {
        const rowA = a as Record<string, unknown>;
        const rowB = b as Record<string, unknown>;
        const totalA = categorySeries.reduce((sum, item) => sum + Number(rowA[item.key] ?? 0), 0);
        const totalB = categorySeries.reduce((sum, item) => sum + Number(rowB[item.key] ?? 0), 0);
        return totalB - totalA;
      });
  };

  const departmentChart = useMemo(
    () => buildGroupChart("Department", overviewRowsForDepartmentChart),
    [overviewRowsForDepartmentChart, testKey, fallbackKeys],
  );

  const factoryChart = useMemo(
    () => buildGroupChart("Factory", overviewRowsForFactoryChart),
    [overviewRowsForFactoryChart, testKey, fallbackKeys],
  );

  const sectionChart = useMemo(
    () => buildGroupChart("Section", overviewRows),
    [overviewRows, testKey, fallbackKeys],
  );

  const overviewFactoryPieData = useMemo(() => {
    const first = factoryChart[0] as Record<string, unknown> | undefined;
    if (!first) return [];
    return categorySeries
      .map((item) => ({ key: item.key, name: item.name, value: Number(first[item.key] ?? 0) }))
      .filter((item) => item.value > 0);
  }, [factoryChart, categorySeries]);

  const singleSectionName = useMemo(() => {
    if (overviewSection && overviewSection !== "-") return overviewSection;
    if (overviewSectionOptions.length === 1) {
      return overviewSectionOptions[0] === "-" ? "ไม่ระบุ Section" : overviewSectionOptions[0];
    }
    if (sectionChart.length === 1) {
      const name = normalizeValue(sectionChart[0]?.name);
      return !name || name === "-" ? "ไม่ระบุ Section" : name;
    }
    return "";
  }, [overviewSection, overviewSectionOptions, sectionChart]);

  const shouldShowSectionPie =
    Boolean(overviewSection) ||
    (Boolean(overviewDepartment) && (overviewSectionOptions.length === 1 || sectionChart.length === 1));

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-lg font-semibold text-gray-800">ค้นหาข้อมูลพนักงาน</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-col gap-2 text-sm text-gray-600 md:max-w-[180px]">
              Factory
              <select
                className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={factoryId}
                onChange={(event) => setFactoryId(Number(event.target.value))}
              >
                <option value={1}>TS</option>
                <option value={2}>TL</option>
                <option value={3}>KK</option>
                <option value={4}>BS</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-600 md:flex-1">
              SCG EmpID
              <select
                className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={selectedEmpId}
                onChange={(event) => setSelectedEmpId(event.target.value)}
              >
                <option value="">เลือกพนักงาน</option>
                {people.map((person) => (
                  <option
                    key={person.empId}
                    value={person.empId}
                    className={
                      isHighlightedToxicTest && highlightedAbnormalEmpIds.has(person.empId)
                        ? "text-red-700 font-semibold"
                        : isPhenolTest && phenolThreeYearEmpIds.has(person.empId)
                          ? "text-blue-700 font-semibold"
                        : undefined
                    }
                    style={
                      isHighlightedToxicTest && highlightedAbnormalEmpIds.has(person.empId)
                        ? { color: "#B91C1C", fontWeight: 600 }
                        : isPhenolTest && phenolThreeYearEmpIds.has(person.empId)
                          ? { color: "#1D4ED8", fontWeight: 600 }
                        : undefined
                    }
                  >
                    {person.empId} - {person.name || "ไม่ทราบชื่อ"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-lg font-semibold text-gray-800">ส่วนบุคคล</div>
          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading...</div>
          ) : selectedPerson ? (
            <div className="grid gap-4 text-sm text-gray-700">
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-semibold text-indigo-700">
                    {getInitial(normalizeValue(selectedPerson.Name)) || "?"}
                  </div>
                  <div>
                    <div className="text-xs text-indigo-500">พนักงานที่เลือก</div>
                    <div className="text-base font-semibold text-gray-900">
                      {normalizeValue(selectedPerson.Name) || "ไม่ทราบชื่อ"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {normalizeValue(selectedPerson.Position)} · {normalizeValue(selectedPerson.Department)}
                    </div>
                    {selectedEmpId && (
                      <div className="mt-2 inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-600">
                        {selectedEmpId}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-lg font-semibold text-gray-800">
                    สรุปผลตรวจ {displayTitle} ปี {selectedYear}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Year
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
                      value={selectedYear}
                      onChange={(event) => {
                        setSelectedYearTouched(true);
                        setSelectedYear(event.target.value);
                      }}
                    >
                      {selectedEmpAvailableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {isBloodPressure && bpValues ? (
                    <>
                      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                        <div className="text-xs text-blue-700">BP Sys</div>
                        <div className="mt-2 text-2xl font-semibold text-blue-900">{bpSysValue}</div>
                      </div>
                      <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                        <div className="text-xs text-indigo-700">BP Dia</div>
                        <div className="mt-2 text-2xl font-semibold text-indigo-900">{bpDiaValue}</div>
                      </div>
                    </>
                  ) : null}
                  {showResultCard ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-600">ผลตรวจ</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{resultDisplay}</div>
                    </div>
                  ) : null}
                  {!isLipid && !isLiver && !isKidney ? (
                    <div
                      className={
                        selectedResult?.bucket === "normal"
                          ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                          : selectedResult?.bucket === "abnormal" || selectedResult?.bucket === "high"
                            ? "rounded-xl border border-red-200 bg-red-50 p-4"
                            : selectedResult?.bucket === "low"
                              ? "rounded-xl border border-yellow-200 bg-yellow-50 p-4"
                            : "rounded-xl border border-gray-200 bg-gray-50 p-4"
                      }
                    >
                      <div className="text-xs text-slate-600">ผลตรวจ</div>
                      <div
                        className={
                          selectedResult?.bucket === "normal"
                            ? "mt-2 text-2xl font-semibold text-emerald-700"
                            : selectedResult?.bucket === "abnormal" || selectedResult?.bucket === "high"
                              ? "mt-2 text-2xl font-semibold text-red-700"
                              : selectedResult?.bucket === "low"
                                ? "mt-2 text-2xl font-semibold text-yellow-700"
                              : "mt-2 text-2xl font-semibold text-gray-700"
                        }
                      >
                        {selectedResult
                          ? categoryLabelFromValue(selectedResult.raw, selectedResult.bucket, testKey)
                          : categoryLabel("other")}
                      </div>
                    </div>
                  ) : null}
                </div>
                {isLipid && selectedResult ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-sm font-semibold text-gray-800">รายละเอียดค่าไขมัน</div>
                    {(() => {
                      const lipid = parseLipidParts(selectedResult.raw);
                      const items = [
                        { label: "Total Cholesterol", value: lipid.tc, abnormal: lipid.tc !== null && lipid.tc >= 200 },
                        { label: "Triglyceride", value: lipid.tg, abnormal: lipid.tg !== null && lipid.tg >= 150 },
                        { label: "HDL", value: lipid.hdl, abnormal: lipid.hdl !== null && lipid.hdl < 35 },
                        { label: "LDL", value: lipid.ldl, abnormal: lipid.ldl !== null && lipid.ldl >= 150 },
                      ];
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                                <th className="py-2">รายการ</th>
                                <th className="py-2">ค่า</th>
                                <th className="py-2">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.label} className="border-b border-gray-100">
                                  <td className="py-2">{item.label}</td>
                                  <td className="py-2">{item.value ?? "-"}</td>
                                  <td className={`py-2 font-semibold ${item.abnormal ? "text-red-700" : "text-emerald-700"}`}>
                                    {item.value === null ? "-" : item.abnormal ? "ผิดปกติ" : "ปกติ"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                {isLiver && selectedResult ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-sm font-semibold text-gray-800">รายละเอียดค่าตับ</div>
                    {(() => {
                      const liver = parseLiverParts(selectedResult.raw);
                      const sexRaw = normalizeValue(selectedPerson?.Sex).toLowerCase();
                      const isFemale =
                        sexRaw.includes("หญิง") ||
                        sexRaw === "f" ||
                        sexRaw.includes("female");
                      const sgptUpper = isFemale ? 35 : 50;
                      const items = [
                        {
                          label: "SGOT",
                          value: liver.sgot,
                          abnormal: liver.sgot !== null && (liver.sgot < 15 || liver.sgot > 46),
                        },
                        {
                          label: "SGPT",
                          value: liver.sgpt,
                          abnormal: liver.sgpt !== null && liver.sgpt >= sgptUpper,
                        },
                        {
                          label: "ALKP",
                          value: liver.alkp,
                          abnormal: liver.alkp !== null && (liver.alkp < 38 || liver.alkp > 126),
                        },
                      ];
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                                <th className="py-2">รายการ</th>
                                <th className="py-2">ค่า</th>
                                <th className="py-2">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.label} className="border-b border-gray-100">
                                  <td className="py-2">{item.label}</td>
                                  <td className="py-2">{item.value ?? "-"}</td>
                                  <td className={`py-2 font-semibold ${item.abnormal ? "text-red-700" : "text-emerald-700"}`}>
                                    {item.value === null ? "-" : item.abnormal ? "ผิดปกติ" : "ปกติ"}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                {isKidney && selectedResult ? (
                  <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4">
                    <div className="mb-2 text-sm font-semibold text-gray-800">รายละเอียดค่าไต</div>
                    {(() => {
                      const kidney = parseKidneyParts(selectedResult.raw);
                      const summaryBucket = categorizeNormalAbnormal(
                        selectedResult.raw,
                        testKey,
                        selectedPerson?.Sex,
                      );
                      const summaryLabel = categoryLabelFromValue(
                        selectedResult.raw,
                        selectedResult.bucket,
                        testKey,
                      );
                      const bunAbnormal =
                        kidney.bun !== null ? isBunAbnormal(kidney.bun, selectedPerson?.Sex) : null;
                      const creatinineAbnormal =
                        kidney.creatinine !== null
                          ? isCreatinineAbnormal(kidney.creatinine, selectedPerson?.Sex)
                          : null;
                      const items = [
                        {
                          label: "BUN",
                          value: kidney.bun,
                          status:
                            kidney.bun === null ? "-" : bunAbnormal ? "ผิดปกติ" : "ปกติ",
                          statusClass:
                            kidney.bun === null
                              ? "text-gray-500"
                              : bunAbnormal
                                ? "text-red-700"
                                : "text-emerald-700",
                        },
                        {
                          label: "Creatinine",
                          value: kidney.creatinine,
                          status:
                            kidney.creatinine === null
                              ? "-"
                              : creatinineAbnormal
                                ? "ผิดปกติ"
                                : "ปกติ",
                          statusClass:
                            kidney.creatinine === null
                              ? "text-gray-500"
                              : creatinineAbnormal
                                ? "text-red-700"
                                : "text-emerald-700",
                        },
                      ];
                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 text-left text-xs text-gray-500">
                                <th className="py-2">รายการ</th>
                                <th className="py-2">ค่า</th>
                                <th className="py-2">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {items.map((item) => (
                                <tr key={item.label} className="border-b border-gray-100">
                                  <td className="py-2">{item.label}</td>
                                  <td className="py-2">{item.value ?? "-"}</td>
                                  <td className={`py-2 font-semibold ${item.statusClass}`}>
                                    {item.status}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-lg font-semibold text-gray-800">แนวโน้มรายปี</div>
                {isLipid && lipidTrend ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {lipidTrend.map((metric) => (
                      <div key={metric.key} className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 text-xs font-semibold text-gray-700">{metric.label}</div>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metric.data} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                              <XAxis
                                dataKey="year"
                                padding={{ left: 48, right: 48 }}
                                tickMargin={6}
                              />
                              <YAxis
                                allowDecimals={false}
                                tickFormatter={integerTick}
                                domain={getPaddedDomain(
                                  toNumericValues(metric.data.map((d) => d.value)),
                                  metric.key === "tc"
                                    ? [200]
                                    : metric.key === "tg"
                                      ? [150]
                                      : metric.key === "hdl"
                                        ? [35]
                                        : [150],
                                )}
                              />
                              {metric.key === "tc" ? <ReferenceLine y={200} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("200")} /> : null}
                              {metric.key === "tg" ? <ReferenceLine y={150} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("150")} /> : null}
                              {metric.key === "hdl" ? <ReferenceLine y={35} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("35")} /> : null}
                              {metric.key === "ldl" ? <ReferenceLine y={150} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("150")} /> : null}
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#2563EB"
                                strokeWidth={2}
                                connectNulls={false}
                                dot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  const value = payload?.value;
                                  return renderValueDotWithLabel({
                                    cx,
                                    cy,
                                    fill: isBad ? STRONG_RED_DOT : "#16A34A",
                                    label: typeof value === "number" ? String(Math.round(value * 100) / 100) : "",
                                  });
                                }}
                                activeDot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  return (
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={7}
                                      fill={isBad ? STRONG_RED_DOT : "#16A34A"}
                                      stroke="#FFFFFF"
                                      strokeWidth={2}
                                    />
                                  );
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isLiver && liverTrend ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {liverTrend.map((metric) => (
                      <div key={metric.key} className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 text-xs font-semibold text-gray-700">{metric.label}</div>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metric.data} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                              <XAxis dataKey="year" padding={{ left: 48, right: 48 }} tickMargin={6} />
                              <YAxis
                                allowDecimals={false}
                                tickFormatter={integerTick}
                                domain={getPaddedDomain(
                                  toNumericValues(metric.data.map((d) => d.value)),
                                  metric.key === "sgot"
                                    ? [15, 46]
                                    : metric.key === "sgpt"
                                      ? [
                                          normalizeValue(selectedPerson?.Sex).toLowerCase().includes("หญิง") ||
                                          normalizeValue(selectedPerson?.Sex).toLowerCase() === "f" ||
                                          normalizeValue(selectedPerson?.Sex).toLowerCase().includes("female")
                                            ? 35
                                            : 50,
                                        ]
                                      : [38, 126],
                                )}
                              />
                              {metric.key === "sgot" ? (
                                <>
                                  <ReferenceLine y={15} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("15")} />
                                  <ReferenceLine y={46} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("46")} />
                                </>
                              ) : null}
                              {metric.key === "sgpt" ? (
                                <ReferenceLine
                                  y={
                                    normalizeValue(selectedPerson?.Sex).toLowerCase().includes("หญิง") ||
                                    normalizeValue(selectedPerson?.Sex).toLowerCase() === "f" ||
                                    normalizeValue(selectedPerson?.Sex).toLowerCase().includes("female")
                                      ? 35
                                      : 50
                                  }
                                  {...REFERENCE_LINE_STYLE}
                                  label={referenceLineLabel(
                                    String(
                                      normalizeValue(selectedPerson?.Sex).toLowerCase().includes("หญิง") ||
                                        normalizeValue(selectedPerson?.Sex).toLowerCase() === "f" ||
                                        normalizeValue(selectedPerson?.Sex).toLowerCase().includes("female")
                                        ? 35
                                        : 50,
                                    ),
                                  )}
                                />
                              ) : null}
                              {metric.key === "alkp" ? (
                                <>
                                  <ReferenceLine y={38} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("38")} />
                                  <ReferenceLine y={126} {...REFERENCE_LINE_STYLE} label={referenceLineLabel("126")} />
                                </>
                              ) : null}
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#2563EB"
                                strokeWidth={2}
                                connectNulls={false}
                                dot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  const value = payload?.value;
                                  return renderValueDotWithLabel({
                                    cx,
                                    cy,
                                    fill: isBad ? STRONG_RED_DOT : "#16A34A",
                                    label: typeof value === "number" ? String(Math.round(value * 100) / 100) : "",
                                  });
                                }}
                                activeDot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  return (
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={7}
                                      fill={isBad ? STRONG_RED_DOT : "#16A34A"}
                                      stroke="#FFFFFF"
                                      strokeWidth={2}
                                    />
                                  );
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : isKidney && kidneyTrend ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {kidneyTrend.map((metric) => (
                      <div key={metric.key} className="rounded-lg border border-gray-200 p-3">
                        <div className="mb-2 text-xs font-semibold text-gray-700">{metric.label}</div>
                        <div className="h-36">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={metric.data} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                              <XAxis dataKey="year" padding={{ left: 48, right: 48 }} tickMargin={6} />
                              <YAxis
                                allowDecimals={false}
                                tickFormatter={integerTick}
                                domain={getPaddedDomain(
                                  toNumericValues(metric.data.map((d) => d.value)),
                                  metric.key === "bun"
                                    ? [getBunRange(selectedPerson?.Sex).min, getBunRange(selectedPerson?.Sex).max]
                                    : [
                                        getCreatinineRange(selectedPerson?.Sex).min,
                                        getCreatinineRange(selectedPerson?.Sex).max,
                                      ],
                                )}
                              />
                              {metric.key === "bun" ? (
                                <>
                                  <ReferenceLine y={getBunRange(selectedPerson?.Sex).min} {...REFERENCE_LINE_STYLE} label={referenceLineLabel(String(getBunRange(selectedPerson?.Sex).min))} />
                                  <ReferenceLine y={getBunRange(selectedPerson?.Sex).max} {...REFERENCE_LINE_STYLE} label={referenceLineLabel(String(getBunRange(selectedPerson?.Sex).max))} />
                                </>
                              ) : null}
                              {metric.key === "creatinine" ? (
                                <>
                                  <ReferenceLine
                                    y={getCreatinineRange(selectedPerson?.Sex).min}
                                    {...REFERENCE_LINE_STYLE}
                                    label={referenceLineLabel(String(getCreatinineRange(selectedPerson?.Sex).min))}
                                  />
                                  <ReferenceLine
                                    y={getCreatinineRange(selectedPerson?.Sex).max}
                                    {...REFERENCE_LINE_STYLE}
                                    label={referenceLineLabel(String(getCreatinineRange(selectedPerson?.Sex).max))}
                                  />
                                </>
                              ) : null}
                              <Tooltip />
                              <Line
                                type="monotone"
                                dataKey="value"
                                stroke="#2563EB"
                                strokeWidth={2}
                                connectNulls={false}
                                dot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  const value = payload?.value;
                                  return renderValueDotWithLabel({
                                    cx,
                                    cy,
                                    fill: isBad ? STRONG_RED_DOT : "#16A34A",
                                    label: typeof value === "number" ? String(Math.round(value * 100) / 100) : "",
                                  });
                                }}
                                activeDot={({ cx, cy, payload }) => {
                                  if (typeof cx !== "number" || typeof cy !== "number") return null;
                                  const isBad = Boolean(payload?.abnormal);
                                  return (
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={7}
                                      fill={isBad ? STRONG_RED_DOT : "#16A34A"}
                                      stroke="#FFFFFF"
                                      strokeWidth={2}
                                    />
                                  );
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                        <XAxis dataKey="year" padding={{ left: 48, right: 48 }} />
                        {isNumericTrend ? (
                            <YAxis
                              allowDecimals={isTolueneTest || isXyleneTest}
                              tickFormatter={isTolueneTest || isXyleneTest ? decimalTick : integerTick}
                              domain={
                                isTolueneTest
                                  ? tolueneTrendDomain
                                  : isXyleneTest
                                    ? xyleneTrendDomain
                                  : getPaddedDomain(
                                      toNumericValues(trend.map((p) => p.value)),
                                      numericReferenceValues,
                                    )
                              }
                            />
                        ) : (
                          <YAxis
                            domain={isBloodPressure ? [0, 1.3] : [0.3, 1.3]}
                            ticks={isBloodPressure ? [0.2, 0.6, 1] : [0.6, 1]}
                            tickFormatter={(value) => {
                              if (isBloodPressure) return value >= 1 ? "สูง" : value >= 0.6 ? "ปกติ" : "ต่ำ";
                              return value >= 1 ? "ผิดปกติ" : "ปกติ";
                            }}
                          />
                        )}
                        {isNumericTrend
                          ? numericReferenceValues.map((value) => (
                              <ReferenceLine
                                key={`ref-${testKey}-${value}`}
                                y={value}
                                {...REFERENCE_LINE_STYLE}
                                label={referenceLineLabel(String(value))}
                              />
                            ))
                          : null}
                        <Tooltip content={<TrendTooltip testKey={testKey} />} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="#2563EB"
                          strokeWidth={2}
                          connectNulls={false}
                          dot={({ cx, cy, payload }) => {
                            if (typeof cx !== "number" || typeof cy !== "number") return null;
                            const bucket = String(payload?.bucket ?? "");
                            const fill =
                              bucket === "abnormal" ||
                              bucket === "high" ||
                              bucket === "low" ||
                              bucket === "cholesterolHigh" ||
                              bucket === "triglycerideHigh" ||
                              bucket === "hdlLow" ||
                              bucket === "ldlHigh"
                                ? STRONG_RED_DOT
                                : "#2563EB";
                            const label = isNumericTrend
                              ? typeof payload?.value === "number"
                                ? String(Math.round(payload.value * 100) / 100)
                                : ""
                              : categoryLabelFromValue(String(payload?.raw ?? ""), bucket, testKey);
                            return renderValueDotWithLabel({
                              cx,
                              cy,
                              fill,
                              label,
                              radius: 4,
                            });
                          }}
                          activeDot={({ cx, cy, payload }) => {
                            if (typeof cx !== "number" || typeof cy !== "number") return null;
                            const bucket = String(payload?.bucket ?? "");
                            const fill =
                              bucket === "abnormal" ||
                              bucket === "high" ||
                              bucket === "low" ||
                              bucket === "cholesterolHigh" ||
                              bucket === "triglycerideHigh" ||
                              bucket === "hdlLow" ||
                              bucket === "ldlHigh"
                                ? STRONG_RED_DOT
                                : "#2563EB";
                            return (
                              <circle
                                cx={cx}
                                cy={cy}
                                r={5}
                                fill={fill}
                                stroke="#111827"
                                strokeWidth={1}
                              />
                            );
                          }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">เลือกพนักงานเพื่อดูรายละเอียด</div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-lg font-semibold text-gray-800">ภาพรวม</div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Year
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={overviewYear}
                onChange={(event) => {
                  setOverviewYearTouched(true);
                  setOverviewYear(event.target.value);
                }}
              >
                {overviewAvailableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Factory
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={overviewFactory}
                onChange={(event) => setOverviewFactory(event.target.value)}
              >
                <option value="">ทั้งหมด</option>
                <option value="1">TS</option>
                <option value="2">TL</option>
                <option value="3">KK</option>
                <option value="4">BS</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Department
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={overviewDepartment}
                onChange={(event) => setOverviewDepartment(event.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {overviewDepartmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Department Search
              <input
                type="text"
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                placeholder="ค้นหา Department"
                value={overviewDepartmentSearch}
                onChange={(event) => setOverviewDepartmentSearch(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Section
              <select
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={overviewSection}
                onChange={(event) => setOverviewSection(event.target.value)}
              >
                <option value="">ทั้งหมด</option>
                {overviewSectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-xs text-gray-600">
              Section Search
              <input
                type="text"
                className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                placeholder="ค้นหา Section"
                value={overviewSectionSearch}
                onChange={(event) => setOverviewSectionSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="grid gap-4">
            <div className={isLipid || isKidney ? "rounded-xl border border-gray-200 bg-white p-3" : "rounded-xl border border-gray-200 bg-white p-4"}>
              <div className={isLipid || isKidney ? "mb-3 text-base font-semibold text-gray-800" : "mb-4 text-lg font-semibold text-gray-800"}>
                สรุปผลตรวจ {displayTitle} ปี {overviewYear}
              </div>
                <div className={isLipid ? "mx-auto grid max-w-4xl gap-1.5 sm:grid-cols-2 lg:grid-cols-4" : isLiver || isKidney ? "mx-auto grid max-w-3xl gap-2 sm:grid-cols-2 md:grid-cols-3" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"}>
                  <div className={isLipid || isLiver || isKidney ? "rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-center" : "rounded-xl border border-emerald-200 bg-emerald-50 p-4"}>
                    <div className="text-xs text-emerald-700">ปกติ</div>
                    <div className={isLipid || isLiver || isKidney ? "mt-0.5 text-lg font-semibold text-emerald-900" : "mt-2 text-2xl font-semibold text-emerald-900"}>
                      {summaryOverview.normal ?? 0}
                    </div>
                  </div>
                  {isBloodPressure || isBMI ? (
                    <>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="text-xs text-red-700">{isBloodPressure ? "ความดันสูง" : "สูงกว่าเกณฑ์ปกติ"}</div>
                        <div className="mt-2 text-2xl font-semibold text-red-900">
                          {summaryOverview.high ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                        <div className="text-xs text-yellow-700">{isBloodPressure ? "ความดันต่ำ" : "ต่ำกว่าเกณฑ์ปกติ"}</div>
                        <div className="mt-2 text-2xl font-semibold text-yellow-900">
                          {summaryOverview.low ?? 0}
                        </div>
                      </div>
                    </>
                  ) : isLipid ? (
                    <>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-center">
                        <div className="text-xs text-red-700">ไขมันคลอเลสเตอรอลสูง</div>
                        <div className="mt-0.5 text-lg font-semibold text-red-900">
                          {summaryOverview.cholesterolHigh ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-2 text-center">
                        <div className="text-xs text-orange-700">ไขมันไตรกลีเซอไรด์สูง</div>
                        <div className="mt-0.5 text-lg font-semibold text-orange-900">
                          {summaryOverview.triglycerideHigh ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-center">
                        <div className="text-xs text-amber-700">ไขมัน HDL ต่ำกว่าปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-amber-900">
                          {summaryOverview.hdlLow ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-center">
                        <div className="text-xs text-rose-700">ไขมันตัวร้าย (LDL) สูง</div>
                        <div className="mt-0.5 text-lg font-semibold text-rose-900">
                          {summaryOverview.ldlHigh ?? 0}
                        </div>
                      </div>
                    </>
                  ) : isLiver ? (
                    <>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-center">
                        <div className="text-xs text-red-700 text-center">SGOT ผิดปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-red-900">
                          {summaryOverview.sgotAbnormal ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-2 text-center">
                        <div className="text-xs text-orange-700 text-center">SGPT ผิดปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-orange-900">
                          {summaryOverview.sgptAbnormal ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-center">
                        <div className="text-xs text-rose-700 text-center">ALKP ผิดปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-rose-900">
                          {summaryOverview.alkpAbnormal ?? 0}
                        </div>
                      </div>
                    </>
                  ) : isKidney ? (
                    <>
                      <div className="rounded-xl border border-red-200 bg-red-50 p-2 text-center">
                        <div className="text-xs text-red-700 text-center">BUN ผิดปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-red-900">
                          {summaryOverview.bunAbnormal ?? 0}
                        </div>
                      </div>
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-2 text-center">
                        <div className="text-xs text-orange-700 text-center">Creatinine ผิดปกติ</div>
                        <div className="mt-0.5 text-lg font-semibold text-orange-900">
                          {summaryOverview.creatinineAbnormal ?? 0}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="text-xs text-red-700">ผิดปกติ</div>
                      <div className="mt-2 text-2xl font-semibold text-red-900">
                        {summaryOverview.abnormal ?? 0}
                      </div>
                    </div>
                  )}
                <div className={isLipid || isLiver || isKidney ? "rounded-xl border border-gray-200 bg-gray-50 p-2 text-center" : "rounded-xl border border-gray-200 bg-gray-50 p-4"}>
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className={isLipid || isKidney ? "mt-0.5 text-lg font-semibold text-gray-900" : "mt-2 text-2xl font-semibold text-gray-900"}>
                    {summaryOverview.notTested ?? 0}
                  </div>
                </div>
                <div className={isLipid || isLiver || isKidney ? "rounded-xl border border-slate-200 bg-slate-50 p-2 text-center" : "rounded-xl border border-slate-200 bg-slate-50 p-4"}>
                  <div className="text-xs text-slate-600">อื่นๆ</div>
                  <div className={isLipid || isKidney ? "mt-0.5 text-lg font-semibold text-slate-900" : "mt-2 text-2xl font-semibold text-slate-900"}>
                    {summaryOverview.other ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 min-h-[56px] text-lg font-semibold leading-tight text-gray-800">
                  สัดส่วน {displayTitle} ตาม Factory
                </div>
                <div className="h-72">
                  {factoryChart.length === 1 ? (
                    overviewFactoryPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewFactoryPieData} dataKey="value" nameKey="name" outerRadius={95} label={showPieSliceLabel}>
                            {overviewFactoryPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend
                            iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                            wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                            formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : factoryChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={factoryChart}
                        margin={isLipid ? { top: 8, right: 8, left: 0, bottom: 32 } : undefined}
                      >
                        <XAxis
                          dataKey="name"
                          interval="preserveStartEnd"
                          minTickGap={isLipid ? 18 : 8}
                          tick={{ fontSize: isLipid || isLiver || isKidney ? 10 : 12 }}
                          height={isLipid || isLiver || isKidney ? 44 : undefined}
                          tickFormatter={isLipid || isLiver || isKidney ? (value) => compactAxisLabel(value, 12) : undefined}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend
                          iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                          wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                          formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                        />
                        {categorySeries.map((item) => (
                          <Bar
                            key={item.key}
                            dataKey={item.key}
                            name={item.name}
                            fill={PIE_COLORS[item.key] ?? "#94A3B8"}
                            stackId="test"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">
                      ไม่มีกลุ่มข้อมูล
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 min-h-[56px] text-lg font-semibold leading-tight text-gray-800">
                  {overviewDepartment
                    ? overviewDepartment
                    : `สัดส่วน ${displayTitle} ตาม Department`}
                </div>
                <div className="h-72">
                  {overviewDepartment ? (
                    overviewDepartmentPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewDepartmentPieData} dataKey="value" nameKey="name" outerRadius={95} label={showPieSliceLabel}>
                            {overviewDepartmentPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend
                            iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                            wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                            formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : departmentChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={departmentChart}
                        margin={isLipid ? { top: 8, right: 8, left: 0, bottom: 32 } : undefined}
                      >
                        <XAxis
                          dataKey="name"
                          interval="preserveStartEnd"
                          minTickGap={isLipid ? 18 : 8}
                          tick={{ fontSize: isLipid || isLiver || isKidney ? 10 : 12 }}
                          height={isLipid || isLiver || isKidney ? 44 : undefined}
                          tickFormatter={isLipid || isLiver || isKidney ? (value) => compactAxisLabel(value, 12) : undefined}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend
                          iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                          wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                          formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                        />
                        {categorySeries.map((item) => (
                          <Bar
                            key={item.key}
                            dataKey={item.key}
                            name={item.name}
                            fill={PIE_COLORS[item.key] ?? "#94A3B8"}
                            stackId="test"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">
                      ไม่มีกลุ่มข้อมูล
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 min-h-[56px] text-lg font-semibold leading-tight text-gray-800">
                  {shouldShowSectionPie && singleSectionName
                      ? singleSectionName
                    : `สัดส่วน ${displayTitle} ตาม Section`}
                </div>
                <div className="h-72">
                  {shouldShowSectionPie ? (
                    overviewPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewPieData} dataKey="value" nameKey="name" outerRadius={95} label={showPieSliceLabel}>
                            {overviewPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend
                            iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                            wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                            formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : sectionChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={sectionChart}
                        margin={isLipid ? { top: 8, right: 8, left: 0, bottom: 32 } : undefined}
                      >
                        <XAxis
                          dataKey="name"
                          interval="preserveStartEnd"
                          minTickGap={isLipid ? 18 : 8}
                          tick={{ fontSize: isLipid || isLiver || isKidney ? 10 : 12 }}
                          height={isLipid || isLiver || isKidney ? 44 : undefined}
                          tickFormatter={isLipid || isLiver || isKidney ? (value) => compactAxisLabel(value, 12) : undefined}
                        />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend
                          iconSize={isLipid || isLiver || isKidney ? 10 : 14}
                          wrapperStyle={isLipid || isLiver || isKidney ? { fontSize: "11px", lineHeight: "14px" } : undefined}
                          formatter={(value) => legendLabelFormatter(String(value), isLipid, isLiver, isKidney)}
                        />
                        {categorySeries.map((item) => (
                          <Bar
                            key={item.key}
                            dataKey={item.key}
                            name={item.name}
                            fill={PIE_COLORS[item.key] ?? "#94A3B8"}
                            stackId="test"
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-gray-500">
                      ไม่มีกลุ่มข้อมูล
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="text-xs text-gray-500">
          <Link href="/admin/health-check/health-risk" className="hover:underline">
            กลับไปหน้า {backLabel}
          </Link>
        </div>
      </main>
    </div>
  );
}
