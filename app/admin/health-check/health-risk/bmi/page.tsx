"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

const BMI_KEY = "BMI";
const GROUP_FIELDS = [
  { label: "Division", key: "Division" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const parseBmiValue = (value: unknown) => {
  const raw = normalizeValue(value);
  if (!raw) return null;
  const [first] = raw.split(",");
  const number = Number(first?.trim());
  return Number.isFinite(number) ? number : null;
};

const categorizeBmi = (value: unknown) => {
  const bmi = parseBmiValue(value);
  if (bmi === null) return "notTested";
  if (bmi < 18.5) return "underweight";
  if (bmi < 23) return "normal";
  if (bmi < 25) return "overweight";
  return "obese";
};

const bmiCategoryLabel = (bucket: string) => {
  switch (bucket) {
    case "underweight":
      return "น้ำหนักต่ำกว่าเกณฑ์";
    case "normal":
      return "ปกติ";
    case "overweight":
      return "น้ำหนักเกินเกณฑ์";
    case "obese":
      return "อ้วน";
    default:
      return "ไม่ได้รับการตรวจ";
  }
};

type BmiTrendTooltipProps = {
  active?: boolean;
  payload?: Array<{
    payload?: { year?: string; raw?: string; bucket?: string; value?: number | null };
  }>;
};

const BmiTrendTooltip = ({ active, payload }: BmiTrendTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const bucket = point.bucket || "notTested";
  const textColor =
    bucket === "underweight"
      ? "text-yellow-700"
      : bucket === "normal"
        ? "text-emerald-700"
        : bucket === "overweight"
          ? "text-orange-700"
          : bucket === "obese"
            ? "text-red-700"
            : "text-gray-700";
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className={`font-semibold ${textColor}`}>
        {point.value ?? "-"} {bmiCategoryLabel(bucket)}
      </div>
    </div>
  );
};

export default function BmiReport() {
  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<1 | 2>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedYear, setSelectedYear] = useState("2568");
  const [selectedGroupKey, setSelectedGroupKey] = useState("Division");
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

  const bmiTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = factoryId === 1 ? ["2565", "2566", "2567", "2568"] : ["2566", "2567", "2568"];
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const raw = normalizeValue(row?.[BMI_KEY]);
      const value = parseBmiValue(row?.[BMI_KEY]);
      const bucket = categorizeBmi(row?.[BMI_KEY]);
      return {
        year,
        raw,
        bucket,
        value: Number.isFinite(value) ? value : null,
      };
    });
  }, [rowsByYear, selectedEmpId, factoryId]);

  const bmiTrendDomain = useMemo(() => {
    const values = bmiTrend.map((item) => item.value).filter((value): value is number => Number.isFinite(value));
    if (!values.length) return [0, 40] as [number, number];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = 2;
    const lower = Math.max(0, Math.floor(min - padding));
    const upper = Math.ceil(max + padding);
    return [lower, upper] as [number, number];
  }, [bmiTrend]);

  const renderTrendDot = (props: { cx?: number; cy?: number; payload?: { value?: number } }) => {
    const { cx, cy, payload } = props;
    const value = Number(payload?.value ?? NaN);
    if (!Number.isFinite(value)) return null;
    let fill = "#2563EB";
    if (value > 29.9) {
      fill = "#DC2626";
    } else if (value > 24 || value < 18.5) {
      fill = "#F97316";
    }
    return <circle cx={cx} cy={cy} r={5} fill={fill} stroke="#1F2937" strokeWidth={0.5} />;
  };

  const selectedBmiSummary = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear[selectedYear]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = normalizeValue(row[BMI_KEY]);
    const value = parseBmiValue(row[BMI_KEY]);
    const bucket = categorizeBmi(row[BMI_KEY]);
    return { raw, value, bucket };
  }, [rowsByYear, selectedEmpId, selectedYear]);

  useEffect(() => {
    if (!selectedEmpId) return;
    if (!selectedEmpAvailableYears.includes(selectedYear) && selectedEmpAvailableYears.length) {
      setSelectedYear(selectedEmpAvailableYears[selectedEmpAvailableYears.length - 1]);
    }
  }, [selectedEmpId, selectedEmpAvailableYears, selectedYear]);

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

  const bmiSummaryOverview = useMemo(() => {
    const rows = overviewRows;
    const counts = {
      underweight: 0,
      normal: 0,
      overweight: 0,
      obese: 0,
      notTested: 0,
    };
    let total = 0;
    let sum = 0;
    rows.forEach((row) => {
      const value = parseBmiValue(row[BMI_KEY]);
      if (value != null) {
        sum += value;
        total += 1;
      }
      const bucket = categorizeBmi(row[BMI_KEY]);
      counts[bucket] += 1;
    });
    const average = total ? Number((sum / total).toFixed(2)) : null;
    return { counts, average, total };
  }, [overviewRows]);

  const groupChart = useMemo(() => {
    const rows = overviewRows;
    const grouped = new Map<
      string,
      { underweight: number; normal: number; overweight: number; obese: number; notTested: number }
    >();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[selectedGroupKey]) || "Unspecified";
      const bucket = categorizeBmi(row[BMI_KEY]);
      if (!grouped.has(groupName)) {
        grouped.set(groupName, {
          underweight: 0,
          normal: 0,
          overweight: 0,
          obese: 0,
          notTested: 0,
        });
      }
      grouped.get(groupName)![bucket] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort(
        (a, b) =>
          b.underweight + b.normal + b.overweight + b.obese + b.notTested -
          (a.underweight + a.normal + a.overweight + a.obese + a.notTested),
      );
  }, [overviewRows, selectedGroupKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-lg font-semibold text-gray-800">
            ค้นหาข้อมูลพนักงาน
          </div>
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
          <div className="grid gap-4">
            {selectedPerson && (
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
                      {normalizeValue(selectedPerson.Position)} ·{" "}
                      {normalizeValue(selectedPerson.Department)}
                    </div>
                    {selectedEmpId && (
                      <div className="mt-2 inline-flex rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-600">
                        {selectedEmpId}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {selectedPerson && (
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-lg font-semibold text-gray-800">
                    สรุป BMI ของพนักงาน (ปี {selectedYear})
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
                    <div className="text-xs text-slate-600">ค่า BMI</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedBmiSummary?.value != null ? selectedBmiSummary.value : "-"}
                    </div>
                  </div>
                  <div
                    className={
                      selectedBmiSummary?.bucket === "underweight"
                        ? "rounded-xl border border-yellow-200 bg-yellow-50 p-4"
                        : selectedBmiSummary?.bucket === "normal"
                          ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                        : selectedBmiSummary?.bucket === "overweight"
                            ? "rounded-xl border border-orange-200 bg-orange-50 p-4"
                            : selectedBmiSummary?.bucket === "obese"
                              ? "rounded-xl border border-red-200 bg-red-50 p-4"
                              : "rounded-xl border border-gray-200 bg-gray-50 p-4"
                    }
                  >
                    <div className="text-xs text-slate-600">หมวด BMI</div>
                    <div
                      className={
                        selectedBmiSummary?.bucket === "underweight"
                          ? "mt-2 text-2xl font-semibold text-yellow-700"
                          : selectedBmiSummary?.bucket === "normal"
                            ? "mt-2 text-2xl font-semibold text-emerald-700"
                            : selectedBmiSummary?.bucket === "overweight"
                              ? "mt-2 text-2xl font-semibold text-orange-700"
                              : selectedBmiSummary?.bucket === "obese"
                                ? "mt-2 text-2xl font-semibold text-red-700"
                                : "mt-2 text-2xl font-semibold text-gray-700"
                      }
                    >
                      {selectedBmiSummary?.bucket === "underweight"
                        ? "น้ำหนักต่ำกว่าเกณฑ์"
                        : selectedBmiSummary?.bucket === "normal"
                          ? "ปกติ"
                          : selectedBmiSummary?.bucket === "overweight"
                            ? "น้ำหนักเกินเกณฑ์"
                            : selectedBmiSummary?.bucket === "obese"
                              ? "อ้วน"
                              : "ไม่ได้รับการตรวจ"}
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="text-lg font-semibold text-gray-800">แนวโน้ม BMI รายปี</div>
              {loading ? (
                <div className="mt-4 text-sm text-gray-500">Loading...</div>
              ) : selectedPerson ? (
                <div className="mt-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bmiTrend}>
                        <XAxis dataKey="year" />
                          <YAxis domain={bmiTrendDomain} />
                        <Tooltip content={<BmiTrendTooltip />} />
                          <Line
                            type="monotone"
                            dataKey="value"
                            name="BMI"
                            stroke="#2563EB"
                            strokeWidth={2}
                            dot={renderTrendDot}
                          />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-sm text-gray-500">
                  เลือกพนักงานเพื่อดูรายละเอียด
                </div>
              )}
            </div>
          </div>
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
                สรุป BMI ปี 2568
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs text-emerald-700">ปกติ</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">
                    {bmiSummaryOverview.counts.normal}
                  </div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-xs text-orange-700">น้ำหนักเกินเกณฑ์</div>
                  <div className="mt-2 text-2xl font-semibold text-orange-900">
                    {bmiSummaryOverview.counts.overweight}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-xs text-red-700">อ้วน</div>
                  <div className="mt-2 text-2xl font-semibold text-red-900">
                    {bmiSummaryOverview.counts.obese}
                  </div>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-xs text-yellow-700">น้ำหนักต่ำกว่าเกณฑ์</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-900">
                    {bmiSummaryOverview.counts.underweight}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {bmiSummaryOverview.counts.notTested}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">BMI เฉลี่ย (ปี 2568)</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {bmiSummaryOverview.average ?? "-"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    จำนวนผู้มีค่า BMI: {bmiSummaryOverview.total}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-lg font-semibold text-gray-800">
                  สัดส่วน BMI ตามกลุ่ม
                </div>
                <label className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center">
                  จัดกลุ่มตาม
                  <select
                    className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                    value={selectedGroupKey}
                    onChange={(event) => setSelectedGroupKey(event.target.value)}
                  >
                    {GROUP_FIELDS.map((field) => (
                      <option key={field.key} value={field.key}>
                        {field.label === "Division"
                          ? "Division"
                          : field.label === "Department"
                            ? "Department"
                            : "Section"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="h-72">
                {groupChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={groupChart}>
                      <XAxis dataKey="name" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="underweight"
                        name="น้ำหนักต่ำกว่าเกณฑ์"
                        fill="#FACC15"
                        stackId="bmi"
                      />
                      <Bar dataKey="normal" name="ปกติ" fill="#16A34A" stackId="bmi" />
                      <Bar
                        dataKey="overweight"
                        name="น้ำหนักเกินเกณฑ์"
                        fill="#F97316"
                        stackId="bmi"
                      />
                      <Bar dataKey="obese" name="อ้วน" fill="#DC2626" stackId="bmi" />
                      <Bar
                        dataKey="notTested"
                        name="ไม่ได้รับการตรวจ"
                        fill="#6B7280"
                        stackId="bmi"
                      />
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
        </section>

        <div className="text-xs text-gray-500">
          <Link href="/admin/health-check/health-risk" className="hover:underline">
            กลับไปหน้า Health Risk
          </Link>
        </div>
      </main>
    </div>
  );
}

