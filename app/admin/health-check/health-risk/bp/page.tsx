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

const BP_KEY = "Blood Pressure";
const BP_FALLBACK_KEYS = ["ความดันโลหิต"];
const GROUP_FIELDS = [
  { label: "Division", key: "Division" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const categorizeBp = (value: string) => {
  if (value.includes("ต่ำ")) return "low";
  if (value.includes("สูง")) return "high";
  if (value.includes("ปกติ")) return "normal";
  if (value.includes("ไม่ได้รับการตรวจ") || value.includes("ไม่รับการตรวจ") || value.includes("ไม่ตรวจ")) {
    return "notTested";
  }
  return "other";
};

const getBpRawValue = (row: HealthRow | null) => {
  if (!row) return "";
  const primary = normalizeValue(row[BP_KEY]);
  if (primary) return primary;
  for (const key of BP_FALLBACK_KEYS) {
    const fallback = normalizeValue(row[key]);
    if (fallback) return fallback;
  }
  return "";
};

const bpCategoryLabel = (bucket: string) => {
  switch (bucket) {
    case "low":
      return "ความดันต่ำ";
    case "high":
      return "ความดันสูง";
    case "normal":
      return "ปกติ";
    case "notTested":
      return "ไม่ได้รับการตรวจ";
    default:
      return "อื่นๆ";
  }
};

const bpStatusValue = (value: string) => {
  const bucket = categorizeBp(value);
  if (bucket === "low") return 0.2;
  if (bucket === "normal") return 0.6;
  if (bucket === "high") return 1;
  return null;
};

type TrendTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: { year?: string; raw?: string; bucket?: string; value?: number | null } }>;
};

const BpTrendTooltip = ({ active, payload }: TrendTooltipProps) => {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;
  const bucket = point.bucket || "other";
  const textColor =
    bucket === "high"
      ? "text-red-700"
      : bucket === "low"
        ? "text-yellow-700"
        : bucket === "normal"
          ? "text-emerald-700"
          : "text-gray-700";
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <div className={`font-semibold ${textColor}`}>
        {point.raw || "-"} {bpCategoryLabel(bucket)}
      </div>
    </div>
  );
};

export default function BloodPressureReport() {
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

  const selectedBp = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear[selectedYear]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = getBpRawValue(row);
    const bucket = categorizeBp(raw);
    return { raw, bucket };
  }, [rowsByYear, selectedEmpId, selectedYear]);

  useEffect(() => {
    if (!selectedEmpId) return;
    if (!selectedEmpAvailableYears.includes(selectedYear) && selectedEmpAvailableYears.length) {
      setSelectedYear(selectedEmpAvailableYears[selectedEmpAvailableYears.length - 1]);
    }
  }, [selectedEmpId, selectedEmpAvailableYears, selectedYear]);

  const bpTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = factoryId === 1 ? ["2565", "2566", "2567", "2568"] : ["2566", "2567", "2568"];
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const raw = getBpRawValue(row ?? null);
      const bucket = categorizeBp(raw);
      const value = bpStatusValue(raw);
      return {
        year,
        raw,
        value,
        bucket,
        lowValue: bucket === "low" ? value : null,
        normalValue: bucket === "normal" ? value : null,
        highValue: bucket === "high" ? value : null,
      };
    });
  }, [rowsByYear, selectedEmpId, factoryId]);

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

  const bpSummaryOverview = useMemo(() => {
    const rows = overviewRows;
    const counts = { low: 0, normal: 0, high: 0, notTested: 0, other: 0 };
    rows.forEach((row) => {
      const bucket = categorizeBp(getBpRawValue(row));
      counts[bucket] += 1;
    });
    return counts;
  }, [overviewRows]);

  const groupChart = useMemo(() => {
    const rows = overviewRows;
    const grouped = new Map<string, { low: number; normal: number; high: number; notTested: number; other: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[selectedGroupKey]) || "Unspecified";
      const bucket = categorizeBp(getBpRawValue(row));
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { low: 0, normal: 0, high: 0, notTested: 0, other: 0 });
      }
      grouped.get(groupName)![bucket] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort(
        (a, b) =>
          b.low + b.normal + b.high + b.notTested + b.other -
          (a.low + a.normal + a.high + a.notTested + a.other),
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

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-lg font-semibold text-gray-800">
                    สรุปความดันโลหิตของพนักงาน (ปี {selectedYear})
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
                      {selectedBp?.raw || "-"}
                    </div>
                  </div>
                  <div
                    className={
                      selectedBp?.bucket === "low"
                        ? "rounded-xl border border-yellow-200 bg-yellow-50 p-4"
                        : selectedBp?.bucket === "normal"
                          ? "rounded-xl border border-emerald-200 bg-emerald-50 p-4"
                          : selectedBp?.bucket === "high"
                            ? "rounded-xl border border-red-200 bg-red-50 p-4"
                            : "rounded-xl border border-gray-200 bg-gray-50 p-4"
                    }
                  >
                    <div className="text-xs text-slate-600">หมวด</div>
                    <div
                      className={
                        selectedBp?.bucket === "low"
                          ? "mt-2 text-2xl font-semibold text-yellow-700"
                          : selectedBp?.bucket === "normal"
                            ? "mt-2 text-2xl font-semibold text-emerald-700"
                            : selectedBp?.bucket === "high"
                              ? "mt-2 text-2xl font-semibold text-red-700"
                              : "mt-2 text-2xl font-semibold text-gray-700"
                      }
                    >
                      {bpCategoryLabel(selectedBp?.bucket ?? "other")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-lg font-semibold text-gray-800">แนวโน้มรายปี</div>
                <div className="mt-4 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={bpTrend}>
                      <XAxis dataKey="year" />
                        <YAxis
                          domain={[0.1, 1.1]}
                          ticks={[0.2, 0.6, 1]}
                          tickFormatter={(value) =>
                            value >= 1 ? "สูง" : value >= 0.6 ? "ปกติ" : "ต่ำ"
                          }
                        />
                      <Tooltip content={<BpTrendTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={({ cx, cy, payload }) => {
                          if (typeof cx !== "number" || typeof cy !== "number") return null;
                          const bucket = String(payload?.bucket ?? "");
                          const fill = bucket === "high" || bucket === "low" ? "#DC2626" : "#2563EB";
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
                สรุปความดันโลหิต ปี {overviewYear}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs text-emerald-700">ปกติ</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">
                    {bpSummaryOverview.normal}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-xs text-red-700">ความดันสูง</div>
                  <div className="mt-2 text-2xl font-semibold text-red-900">
                    {bpSummaryOverview.high}
                  </div>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-xs text-yellow-700">ความดันต่ำ</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-900">
                    {bpSummaryOverview.low}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {bpSummaryOverview.notTested}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">อื่นๆ</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {bpSummaryOverview.other}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-lg font-semibold text-gray-800">
                  สัดส่วนความดันโลหิตตามกลุ่ม
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
                        {field.label}
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
                      <Bar dataKey="low" name="ความดันต่ำ" fill="#FACC15" stackId="bp" />
                      <Bar dataKey="normal" name="ปกติ" fill="#16A34A" stackId="bp" />
                      <Bar dataKey="high" name="ความดันสูง" fill="#DC2626" stackId="bp" />
                      <Bar dataKey="notTested" name="ไม่ได้รับการตรวจ" fill="#6B7280" stackId="bp" />
                      <Bar dataKey="other" name="อื่นๆ" fill="#94A3B8" stackId="bp" />
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

