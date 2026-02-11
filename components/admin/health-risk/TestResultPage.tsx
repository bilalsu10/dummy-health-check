"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

const isNotTested = (value: string) =>
  value.includes("ไม่ได้รับการตรวจ") ||
  value.includes("ไม่รับการตรวจ") ||
  value.includes("ไม่ตรวจ");

const parseNumeric = (value: string) => {
  const raw = value.split(",")[0]?.trim() ?? "";
  if (!raw) return null;
  const cleaned = raw.replace("<", "");
  const numeric = Number(cleaned);
  return Number.isFinite(numeric) ? numeric : null;
};

const categorizeNormalAbnormal = (value: string, testKey: string) => {
  if (isNotTested(value)) return "notTested";
  const threshold = NUMERIC_THRESHOLDS[testKey];
  if (threshold !== undefined) {
    const numeric = parseNumeric(value);
    if (numeric === null) return "other";
    return numeric >= threshold ? "abnormal" : "normal";
  }
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
    case "abnormal":
      return "ผิดปกติ";
    case "notTested":
      return "ไม่ได้รับการตรวจ";
    default:
      return "อื่นๆ";
  }
};

const categoryLabelFromValue = (value: string, bucket: string) => {
  if (bucket === "abnormal") {
    if (value.includes("สูงกว่าปกติ")) return "สูงกว่าปกติ";
    if (value.includes("ต่ำกว่าปกติ")) return "ต่ำกว่าปกติ";
  }
  return categoryLabel(bucket);
};

const trendValue = (value: string, testKey: string) => {
  if (testKey === "Blood Glucose") {
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
  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<1 | 2>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedYear, setSelectedYear] = useState("2568");
  const [overviewYear, setOverviewYear] = useState("2568");
  const [overviewDepartment, setOverviewDepartment] = useState("");
  const [overviewSection, setOverviewSection] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError(null);
        const resAll = await fetch(`/data/ALL/all.json`, { cache: "no-store" });
        if (!resAll.ok) {
          throw new Error("Failed to load dataset");
        }
        const dataAll = (await resAll.json()) as HealthRow[];
        const filtered = Array.isArray(dataAll)
          ? dataAll.filter((row) => Number(row.FactoryId) === factoryId)
          : [];
        const rows2568 = filtered.filter((row) => String(row.Year) === "2568");
        const rows2567 = filtered.filter((row) => String(row.Year) === "2567");
        const rows2566 = filtered.filter((row) => String(row.Year) === "2566");
        const rows2565 = filtered.filter((row) => String(row.Year) === "2565");
        if (active) {
          setRowsByYear({
            "2568": rows2568,
            "2567": rows2567,
            "2566": rows2566,
            "2565": rows2565,
          });
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
    setSelectedYear("2568");
  }, [factoryId]);

  useEffect(() => {
    setOverviewDepartment("");
    setOverviewSection("");
  }, [factoryId, overviewYear]);

  useEffect(() => {
    setOverviewSection("");
  }, [overviewDepartment]);

  const individualYears = useMemo(
    () => (factoryId === 1 ? ["2565", "2566", "2567", "2568"] : ["2566", "2567", "2568"]),
    [factoryId],
  );

  const people = useMemo(() => {
    const merged = new Map<string, { empId: string; name: string; department: string }>();
    individualYears.forEach((year) => {
      (rowsByYear[year] ?? []).forEach((row) => {
        const empId = normalizeValue(row.SCG_EmpID);
        if (!empId) return;
        if (!merged.has(empId)) {
          merged.set(empId, {
            empId,
            name: normalizeValue(row.Name),
            department: normalizeValue(row.Department),
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

  const trend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2565", "2566", "2567", "2568"];
    return years.map((year) => {
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
  }, [rowsByYear, selectedEmpId, testKey, fallbackKeys]);

  const overviewRowsYear = useMemo(() => rowsByYear[overviewYear] ?? [], [rowsByYear, overviewYear]);

  const overviewDepartmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .map((row) => normalizeValue(row.Department))
          .filter((value) => value && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear]);

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
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear, overviewDepartment]);

  const overviewRows = useMemo(() => {
    return overviewRowsYear.filter((row) => {
      const department = normalizeValue(row.Department);
      const section = normalizeValue(row.Section);
      if (overviewDepartment && department !== overviewDepartment) return false;
      if (overviewSection && section !== overviewSection) return false;
      return true;
    });
  }, [overviewRowsYear, overviewDepartment, overviewSection]);

  const summaryOverview = useMemo(() => {
    const rows = overviewRows;
    const counts = { normal: 0, abnormal: 0, notTested: 0, other: 0 };
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(getTestRawValue(row, testKey, fallbackKeys), testKey);
      counts[bucket] += 1;
    });
    return counts;
  }, [overviewRows, testKey, fallbackKeys]);

  const overviewPieData = useMemo(
    () => [
      { key: "normal", name: "ปกติ", value: summaryOverview.normal },
      { key: "abnormal", name: "ผิดปกติ", value: summaryOverview.abnormal },
      { key: "notTested", name: "ไม่ได้รับการตรวจ", value: summaryOverview.notTested },
      { key: "other", name: "อื่นๆ", value: summaryOverview.other },
    ].filter((item) => item.value > 0),
    [summaryOverview],
  );

  const isNumericTrend = testKey === "Blood Glucose";

  const buildGroupChart = (groupKey: "Department" | "Section") => {
    const rows = overviewRows;
    const grouped = new Map<string, { normal: number; abnormal: number; notTested: number; other: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[groupKey]) || "Unspecified";
      const bucket = categorizeNormalAbnormal(getTestRawValue(row, testKey, fallbackKeys), testKey);
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { normal: 0, abnormal: 0, notTested: 0, other: 0 });
      }
      grouped.get(groupName)![bucket] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort(
        (a, b) =>
          b.normal + b.abnormal + b.notTested + b.other -
          (a.normal + a.abnormal + a.notTested + a.other),
      );
  };

  const departmentChart = useMemo(
    () => buildGroupChart("Department"),
    [overviewRows, testKey, fallbackKeys],
  );

  const sectionChart = useMemo(
    () => buildGroupChart("Section"),
    [overviewRows, testKey, fallbackKeys],
  );

  const singleSectionName = useMemo(() => {
    if (overviewSectionOptions.length === 1) return overviewSectionOptions[0];
    return "";
  }, [overviewSectionOptions]);

  const shouldShowSectionPie =
    Boolean(overviewSection) || (Boolean(overviewDepartment) && overviewSectionOptions.length === 1);

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
                onChange={(event) => setFactoryId(Number(event.target.value) as 1 | 2)}
              >
                <option value={1}>TS</option>
                <option value={2}>TL</option>
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
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-600">ผลตรวจ</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedResult ? getDisplayValue(selectedResult.raw, testKey) : "-"}
                    </div>
                  </div>
                  <div
                    className={
                      selectedResult?.bucket === "normal"
                        ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                        : selectedResult?.bucket === "abnormal"
                          ? "rounded-xl border border-red-200 bg-red-50 p-4"
                          : "rounded-xl border border-gray-200 bg-gray-50 p-4"
                    }
                  >
                    <div className="text-xs text-slate-600">หมวด</div>
                    <div
                      className={
                        selectedResult?.bucket === "normal"
                          ? "mt-2 text-2xl font-semibold text-emerald-700"
                          : selectedResult?.bucket === "abnormal"
                            ? "mt-2 text-2xl font-semibold text-red-700"
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
                          domain={[0.4, 1.1]}
                          ticks={[0.6, 1]}
                          tickFormatter={(value) => (value >= 1 ? "ผิดปกติ" : "ปกติ")}
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
                          const fill = bucket === "abnormal" ? "#DC2626" : "#2563EB";
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
                          const fill = bucket === "abnormal" ? "#DC2626" : "#2563EB";
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
                {factoryId === 1 ? (
                  <>
                    <option value="2565">2565</option>
                    <option value="2566">2566</option>
                    <option value="2567">2567</option>
                    <option value="2568">2568</option>
                  </>
                ) : (
                  <>
                    <option value="2566">2566</option>
                    <option value="2567">2567</option>
                    <option value="2568">2568</option>
                  </>
                )}
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
                    {summaryOverview.normal}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-xs text-red-700">ผิดปกติ</div>
                  <div className="mt-2 text-2xl font-semibold text-red-900">
                    {summaryOverview.abnormal}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {summaryOverview.notTested}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">อื่นๆ</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {summaryOverview.other}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  {overviewDepartment
                    ? overviewDepartment
                    : `สัดส่วน ${title} ตาม Department`}
                </div>
                <div className="h-72">
                  {overviewDepartment ? (
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
                  ) : departmentChart.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={departmentChart}>
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="normal" name="ปกติ" fill="#16A34A" stackId="test" />
                        <Bar dataKey="abnormal" name="ผิดปกติ" fill="#DC2626" stackId="test" />
                        <Bar dataKey="notTested" name="ไม่ได้รับการตรวจ" fill="#6B7280" stackId="test" />
                        <Bar dataKey="other" name="อื่นๆ" fill="#94A3B8" stackId="test" />
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
                  {overviewSection
                    ? overviewSection
                    : shouldShowSectionPie && singleSectionName
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
                        <Bar dataKey="normal" name="ปกติ" fill="#16A34A" stackId="test" />
                        <Bar dataKey="abnormal" name="ผิดปกติ" fill="#DC2626" stackId="test" />
                        <Bar dataKey="notTested" name="ไม่ได้รับการตรวจ" fill="#6B7280" stackId="test" />
                        <Bar dataKey="other" name="อื่นๆ" fill="#94A3B8" stackId="test" />
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


