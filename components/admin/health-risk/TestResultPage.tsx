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

const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getRowYear = (row: HealthRow) =>
  normalizeValue(row.Year ?? row.year ?? row["ปี"] ?? row["year"]);
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const NUMERIC_THRESHOLDS: Record<string, number> = {
  "Blood Lead": 200,
  "Blood Cadmium": 5,
  "Urine Arsenic": 35,
  "Urine Toluene": 1.6,
  "Urine Acetone": 25,
  "Urine Xylene": 1.5,
};

const PIE_COLORS: Record<string, string> = {
  normal: "#16A34A",
  abnormal: "#DC2626",
  high: "#DC2626",
  low: "#F59E0B",
  notTested: "#6B7280",
  other: "#94A3B8",
};

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

const categorizeNormalAbnormal = (value: string, testKey: string) => {
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
    case "notTested":
      return "ไม่ได้รับการตรวจ";
    default:
      return "อื่นๆ";
  }
};

const categoryLabelFromValue = (value: string, bucket: string) => {
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
  return categoryLabel(bucket);
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
  if (bucket === "abnormal") return 1;
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
    const firstPart = value.split(",")[0]?.trim() ?? "";
    return firstPart || "-";
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
  const numeric = parseNumeric(value);
  return numeric === null ? "-" : numeric.toString();
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
    point.bucket === "abnormal"
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
        {shownValue} {categoryLabelFromValue(point.raw ?? "", point.bucket ?? "other")}
      </div>
    </div>
  );
};

export default function TestResultPage({
  title,
  testKey,
  fallbackKeys = [],
  backLabel = "Health Risk",
}: TestResultPageProps) {
  const isBloodPressure = testKey === "Blood Pressure";
  const isBMI = testKey === "BMI";
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
    : [
        { key: "normal", name: "ปกติ" },
        { key: "abnormal", name: "ผิดปกติ" },
        { key: "notTested", name: "ไม่ได้รับการตรวจ" },
        { key: "other", name: "อื่นๆ" },
      ];

  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<number>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState("");
  const [overviewYear, setOverviewYear] = useState("");
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
        const filtered = Array.isArray(dataAll) ? dataAll.filter((row) => matchesFactory(row, factoryId)) : [];

        const years = Array.from(
          new Set(filtered.map((row) => getRowYear(row)).filter(Boolean)),
        ).sort((a, b) => Number(a) - Number(b));

        const nextRowsByYear = years.reduce<Record<string, HealthRow[]>>((acc, year) => {
          acc[year] = filtered.filter((row) => getRowYear(row) === year);
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
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to load data";
          setError(message);
          setRowsByYear({});
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
  }, [factoryId]);

  useEffect(() => {
    setOverviewDepartment("");
    setOverviewSection("");
    setOverviewDepartmentSearch("");
    setOverviewSectionSearch("");
  }, [factoryId, overviewYear]);

  useEffect(() => {
    setOverviewSection("");
    setOverviewSectionSearch("");
  }, [overviewDepartment]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedYear("");
      setOverviewYear("");
      return;
    }

    const latestYear = availableYears[availableYears.length - 1] ?? "";
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
    if (!availableYears.includes(overviewYear)) {
      setOverviewYear(latestYear);
    }
  }, [availableYears, selectedYear, overviewYear]);

  

  const individualYears = availableYears;

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
    if (!selectedEmpId) return;
    if (!selectedEmpAvailableYears.includes(selectedYear) && selectedEmpAvailableYears.length) {
      setSelectedYear(selectedEmpAvailableYears[selectedEmpAvailableYears.length - 1]);
    }
  }, [selectedEmpId, selectedEmpAvailableYears, selectedYear]);

  const selectedResult = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear[selectedYear]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = getTestRawValue(row, testKey, fallbackKeys);
    const bucket = categorizeNormalAbnormal(raw, testKey);
    return { raw, bucket };
  }, [rowsByYear, selectedEmpId, selectedYear, testKey, fallbackKeys]);

  const resultDisplay = selectedResult ? getResultNumberDisplay(selectedResult.raw, testKey) : "-";
  const hasBloodPressureNumeric = selectedResult
    ? /(\d{2,3})\s*\/\s*(\d{2,3})/.test(selectedResult.raw)
    : false;
  const showResultCard = testKey !== "Blood Pressure" || hasBloodPressureNumeric;

  const trend = useMemo(() => {
    if (!selectedEmpId) return [];
    return individualYears.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const raw = getTestRawValue(row ?? null, testKey, fallbackKeys);
      const bucket = categorizeNormalAbnormal(raw, testKey);
      const value = trendValue(raw, testKey);
      return {
        year,
        raw,
        value,
        bucket,
        normalValue: bucket === "normal" ? value : null,
        abnormalValue: bucket === "abnormal" ? value : null,
      };
    });
  }, [rowsByYear, selectedEmpId, testKey, fallbackKeys, individualYears]);

  const overviewRowsYear = useMemo(() => rowsByYear[overviewYear] ?? [], [rowsByYear, overviewYear]);

  const overviewDepartmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
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
  }, [overviewRowsYear, overviewDepartmentSearch]);

  const overviewSectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
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
  }, [overviewRowsYear, overviewDepartment, overviewSectionSearch]);

  const overviewRows = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      const department = normalizeValue(row.Department);
      const section = normalizeValue(row.Section);
      if (overviewDepartment && department !== overviewDepartment) return false;
      if (overviewSection && section !== overviewSection) return false;
      return true;
    });
  }, [overviewRowsYear, overviewDepartment, overviewSection]);

  const overviewRowsForDepartmentChart = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      const department = normalizeValue(row.Department);
      if (overviewDepartment && department !== overviewDepartment) return false;
      return true;
    });
  }, [overviewRowsYear, overviewDepartment]);

  const summaryOverview = useMemo(() => {
    const rows = overviewRows;
    const counts = Object.fromEntries(categorySeries.map((item) => [item.key, 0])) as Record<string, number>;
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(getTestRawValue(row, testKey, fallbackKeys), testKey);
      counts[bucket] = (counts[bucket] ?? 0) + 1;
    });
    return counts;
  }, [overviewRows, testKey, fallbackKeys, categorySeries]);

  const summaryDepartmentOverview = useMemo(() => {
    const rows = overviewRowsForDepartmentChart;
    const counts = Object.fromEntries(categorySeries.map((item) => [item.key, 0])) as Record<string, number>;
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(getTestRawValue(row, testKey, fallbackKeys), testKey);
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

  const isNumericTrend = testKey === "Blood Glucose" || testKey === "BMI";

  const buildGroupChart = (
    groupKey: "Factory" | "Department" | "Section",
    rows: HealthRow[],
  ) => {
    const grouped = new Map<string, Record<string, number>>();
    rows.forEach((row) => {
      const groupName =
        groupKey === "Factory"
          ? factoryLabelFromRow(row)
          : normalizeValue(row[groupKey]) || "Unspecified";
      const bucket = categorizeNormalAbnormal(getTestRawValue(row, testKey, fallbackKeys), testKey);
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
    () => buildGroupChart("Factory", overviewRowsForDepartmentChart),
    [overviewRowsForDepartmentChart, testKey, fallbackKeys],
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
    if (overviewSection) return overviewSection;
    if (overviewSectionOptions.length === 1) return overviewSectionOptions[0];
    if (sectionChart.length === 1) {
      const name = normalizeValue(sectionChart[0]?.name);
      return name || "ไม่ระบุ Section";
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
                  <option key={person.empId} value={person.empId}>
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
                    สรุปผลตรวจ {title} ปี {selectedYear}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Year
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
                      value={selectedYear}
                      onChange={(event) => setSelectedYear(event.target.value)}
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
                  {showResultCard ? (
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs text-slate-600">ผลตรวจ</div>
                      <div className="mt-2 text-2xl font-semibold text-slate-900">{resultDisplay}</div>
                    </div>
                  ) : null}
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
                        ? categoryLabelFromValue(selectedResult.raw, selectedResult.bucket)
                        : categoryLabel("other")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-lg font-semibold text-gray-800">แนวโน้มรายปี</div>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <XAxis dataKey="year" />
                      {isNumericTrend ? (
                        <YAxis allowDecimals />
                      ) : (
                        <YAxis
                          domain={isBloodPressure ? [0.1, 1.1] : [0.4, 1.1]}
                          ticks={isBloodPressure ? [0.2, 0.6, 1] : [0.6, 1]}
                          tickFormatter={(value) => {
                            if (isBloodPressure) return value >= 1 ? "สูง" : value >= 0.6 ? "ปกติ" : "ต่ำ";
                            return value >= 1 ? "ผิดปกติ" : "ปกติ";
                          }}
                        />
                      )}
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
                            bucket === "abnormal" || bucket === "high" || bucket === "low"
                              ? "#DC2626"
                              : "#2563EB";
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={4}
                              fill={fill}
                              stroke="#1F2937"
                              strokeWidth={0.5}
                            />
                          );
                        }}
                        activeDot={({ cx, cy, payload }) => {
                          if (typeof cx !== "number" || typeof cy !== "number") return null;
                          const bucket = String(payload?.bucket ?? "");
                          const fill =
                            bucket === "abnormal" || bucket === "high" || bucket === "low"
                              ? "#DC2626"
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
                onChange={(event) => setOverviewYear(event.target.value)}
              >
                {individualYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
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
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-4 text-lg font-semibold text-gray-800">
                สรุปผลตรวจ {title} ปี {overviewYear}
              </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs text-emerald-700">ปกติ</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-900">
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
                  ) : (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                      <div className="text-xs text-red-700">ผิดปกติ</div>
                      <div className="mt-2 text-2xl font-semibold text-red-900">
                        {summaryOverview.abnormal ?? 0}
                      </div>
                    </div>
                  )}
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {summaryOverview.notTested ?? 0}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">อื่นๆ</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {summaryOverview.other ?? 0}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  สัดส่วน {title} ตาม Factory
                </div>
                <div className="h-72">
                  {factoryChart.length === 1 ? (
                    overviewFactoryPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewFactoryPieData} dataKey="value" nameKey="name" outerRadius={95} label>
                            {overviewFactoryPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : factoryChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={factoryChart}>
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
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
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  {overviewDepartment
                    ? overviewDepartment
                    : `สัดส่วน ${title} ตาม Department`}
                </div>
                <div className="h-72">
                  {overviewDepartment ? (
                    overviewDepartmentPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewDepartmentPieData} dataKey="value" nameKey="name" outerRadius={95} label>
                            {overviewDepartmentPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : departmentChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChart}>
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
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
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  {shouldShowSectionPie && singleSectionName
                      ? singleSectionName
                    : `สัดส่วน ${title} ตาม Section`}
                </div>
                <div className="h-72">
                  {shouldShowSectionPie ? (
                    overviewPieData.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={overviewPieData} dataKey="value" nameKey="name" outerRadius={95} label>
                            {overviewPieData.map((entry) => (
                              <Cell key={entry.key} fill={PIE_COLORS[entry.key] ?? "#94A3B8"} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        ไม่มีกลุ่มข้อมูล
                      </div>
                    )
                  ) : sectionChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sectionChart}>
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
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


