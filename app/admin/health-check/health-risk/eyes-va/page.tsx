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

const VA_KEY = "VA";
const VA_FALLBACK_KEYS = ["ตรวจการมองเห็นระยะไกล"];
const OVERVIEW_GROUPS = [
  { label: "Factory", key: "Factory" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const ปกติizeValue = (value: unknown) => String(value ?? "").trim();
const getRowYear = (row: HealthRow) =>
  ปกติizeValue(row.Year ?? row.year ?? row["ปี"] ?? row["year"]);
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const getVaRawValue = (row: HealthRow | null) => {
  if (!row) return "";
  const primary = ปกติizeValue(row[VA_KEY]);
  if (primary) return primary;
  for (const key of VA_FALLBACK_KEYS) {
    const fallback = ปกติizeValue(row[key]);
    if (fallback) return fallback;
  }
  return "";
};

const parseItems = (value: unknown) => {
  const raw = ปกติizeValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getVisionStatus = (value: string) => {
  if (value.includes("ผิดปกติ") || value.includes("ไม่ชัดเจน")) return "ผิดปกติ";
  if (value.includes("ปกติ") || value.includes("ชัดเจน")) return "ปกติ";
  return "unknown";
};

const getStatusClass = (value: string) => {
  if (value.includes("ผิดปกติ") || value.includes("ไม่ชัดเจน")) {
    return "font-semibold text-red-600";
  }
  if (value.includes("ปกติ") || value.includes("ชัดเจน")) {
    return "font-semibold text-emerald-600";
  }
  return "";
};

const getVaStatusValue = (value: string) => {
  if (value.includes("ผิดปกติ") || value.includes("ไม่ชัดเจน")) return 1;
  if (value.includes("ปกติ") || value.includes("ชัดเจน")) return 0.2;
  return null;
};

const renderTrendDotWithLabel = (cx?: number, cy?: number, isAbnormal?: boolean) => {
  if (typeof cx !== "number" || typeof cy !== "number") return null;
  const fill = isAbnormal ? "#DC2626" : "#2563EB";
  return (
    <g>
      <circle
        cx={cx}
        cy={cy}
        r={isAbnormal ? 6 : 4}
        fill={fill}
        stroke={isAbnormal ? "#7F1D1D" : "transparent"}
        strokeWidth={isAbnormal ? 2 : 0}
      />
      <text x={cx + 8} y={cy - 8} fontSize={11} fill={fill}>
        {isAbnormal ? "ผิดปกติ" : "ปกติ"}
      </text>
    </g>
  );
};

export default function EyesVaReport() {
  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<1 | 2 | 3 | 4>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedYear, setSelectedYear] = useState("2568");
  const [resultYear, setResultYear] = useState("2568");

  const [overviewFactory, setOverviewFactory] = useState<string>("");
  const [overviewDepartment, setOverviewDepartment] = useState<string>("");
  const [overviewSection, setOverviewSection] = useState<string>("");

  const availableYears = useMemo(() => {
    return Object.keys(rowsByYear)
      .filter((year) => (rowsByYear[year] ?? []).length > 0)
      .sort((a, b) => Number(a) - Number(b));
  }, [rowsByYear]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const dataAll = await fetchDatasetJson<HealthRow[]>("ALL/all.json", { cache: "no-store" });
        const allRows = Array.isArray(dataAll) ? dataAll : [];
        const rows2568 = allRows.filter((row) => getRowYear(row) === "2568");
        const rows2567 = allRows.filter((row) => getRowYear(row) === "2567");
        const rows2566 = allRows.filter((row) => getRowYear(row) === "2566");
        const rows2565 = allRows.filter((row) => getRowYear(row) === "2565");
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
  }, []);

  const people = useMemo(() => {
    const baseRows = rowsByYear[selectedYear] ?? [];
    return baseRows
      .filter((row) => matchesFactory(row, factoryId))
      .map((row) => ({
        empId: ปกติizeValue(row.SCG_EmpID),
        name: ปกติizeValue(row.Name),
        department: ปกติizeValue(row.Department),
      }))
      .filter((person) => person.empId);
  }, [rowsByYear, selectedYear, factoryId]);

  const selectedPerson = useMemo(() => {
    if (!selectedEmpId) return null;
    return (
      rowsByYear[selectedYear]?.find(
        (row) => ปกติizeValue(row.SCG_EmpID) === selectedEmpId && matchesFactory(row, factoryId),
      ) ?? null
    );
  }, [rowsByYear, selectedEmpId, selectedYear, factoryId]);

  const selectedEmpAvailableYears = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2565", "2566", "2567", "2568"];
    return years.filter((year) =>
      (rowsByYear[year] ?? []).some(
        (row) => ปกติizeValue(row.SCG_EmpID) === selectedEmpId && matchesFactory(row, factoryId),
      ),
    );
  }, [rowsByYear, selectedEmpId, factoryId]);

  useEffect(() => {
    if (!availableYears.length) return;
    const latestYear = availableYears[availableYears.length - 1];
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(latestYear);
    }
  }, [availableYears, selectedYear]);

  useEffect(() => {
    if (!selectedEmpId) {
      const latestYear = Object.keys(rowsByYear)
        .filter((year) => (rowsByYear[year] ?? []).length > 0)
        .sort((a, b) => Number(a) - Number(b))
        .at(-1) ?? "2568";
      setResultYear(latestYear);
      return;
    }
    if (!selectedEmpAvailableYears.length) return;
    const latestYear = selectedEmpAvailableYears[selectedEmpAvailableYears.length - 1];
    if (resultYear !== latestYear) {
      setResultYear(latestYear);
    }
  }, [selectedEmpId, selectedEmpAvailableYears, resultYear, rowsByYear]);

  const selectedResultRow = useMemo(() => {
    if (!selectedEmpId) return null;
    return (
      rowsByYear[resultYear]?.find(
        (row) => ปกติizeValue(row.SCG_EmpID) === selectedEmpId && matchesFactory(row, factoryId),
      ) ?? null
    );
  }, [rowsByYear, selectedEmpId, resultYear, factoryId]);

  const vaItems = useMemo(() => {
    if (!selectedResultRow) return [];
    return parseItems(getVaRawValue(selectedResultRow));
  }, [selectedResultRow]);

  const vaResult = vaItems[0] ?? "";

  const vaTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = factoryId === 1 ? ["2565", "2566", "2567", "2568"] : ["2566", "2567", "2568"];
    return years.map((year) => {
        const row =
          rowsByYear[year]?.find(
          (item) => ปกติizeValue(item.SCG_EmpID) === selectedEmpId && matchesFactory(item, factoryId),
        ) ?? null;
      const items = parseItems(getVaRawValue(row ?? null));
      const status = getVaStatusValue(items[0] ?? "");
      return { year, value: status };
    });
  }, [rowsByYear, selectedEmpId, factoryId]);

  const overviewRowsYear = useMemo(() => rowsByYear[selectedYear] ?? [], [rowsByYear, selectedYear]);

  const overviewDepartmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? matchesFactory(row, Number(overviewFactory)) : true))
          .map((row) => ปกติizeValue(row.Department))
          .filter((value) => value && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear, overviewFactory]);

  const overviewSectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? matchesFactory(row, Number(overviewFactory)) : true))
          .filter((row) => (overviewDepartment ? ปกติizeValue(row.Department) === overviewDepartment : true))
          .map((row) => ปกติizeValue(row.Section))
          .filter((value) => value && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear, overviewFactory, overviewDepartment]);

  const getRowsForGroupChart = (groupKey: string) => {
    if (groupKey === "Factory") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
        return true;
      });
    }
    if (groupKey === "Department") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
        if (overviewDepartment && ปกติizeValue(row.Department) !== overviewDepartment) return false;
        return true;
      });
    }
    if (groupKey === "Section") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && !matchesFactory(row, Number(overviewFactory))) return false;
        if (overviewDepartment && ปกติizeValue(row.Department) !== overviewDepartment) return false;
        if (overviewSection && ปกติizeValue(row.Section) !== overviewSection) return false;
        return true;
      });
    }
    return overviewRowsYear;
  };

  const shouldShowPieForChart = (chartKey: string) => {
    if (chartKey === "Factory") return Boolean(overviewFactory);
    if (chartKey === "Department") return Boolean(overviewDepartment);
    if (chartKey === "Section") return Boolean(overviewSection);
    return false;
  };

  const factoryNameFromId = (id: string) => {
    if (id === "1") return "TS";
    if (id === "2") return "TL";
    if (id === "3") return "KK";
    if (id === "4") return "BS";
    return "";
  };

  const getChartTitle = (chart: { key: string; label: string }) => {
    if (chart.key === "Factory" && overviewFactory) {
      return factoryNameFromId(overviewFactory) || chart.label;
    }
    if (chart.key === "Department" && overviewDepartment) {
      return overviewDepartment;
    }
    if (chart.key === "Section" && overviewSection) {
      return overviewSection;
    }
    return chart.label;
  };

  const buildGroupChart = (groupKey: string) => {
    const rows = getRowsForGroupChart(groupKey);
    const grouped = new Map<string, { ปกติ: number; ผิดปกติ: number }>();
    rows.forEach((row) => {
      const groupName =
        groupKey === "Factory"
          ? factoryLabelFromRow(row)
          : ปกติizeValue(row[groupKey]) || "Unspecified";
      const status = getVisionStatus(getVaRawValue(row));
      if (status === "unknown") return;
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { ปกติ: 0, ผิดปกติ: 0 });
      }
      grouped.get(groupName)![status] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.ปกติ + b.ผิดปกติ - (a.ปกติ + a.ผิดปกติ));
  };

  const overviewCharts = useMemo(() => {
    return OVERVIEW_GROUPS.map((group) => {
      const data = buildGroupChart(group.key);
      const totals = data.reduce(
        (acc, item) => {
          acc.ปกติ += item.ปกติ ?? 0;
          acc.ผิดปกติ += item.ผิดปกติ ?? 0;
          return acc;
        },
        { ปกติ: 0, ผิดปกติ: 0 },
      );
      return { ...group, data, totals };
    });
  }, [overviewRowsYear, overviewFactory, overviewDepartment, overviewSection]);

  useEffect(() => {
    setOverviewDepartment("");
    setOverviewSection("");
  }, [overviewFactory]);

  useEffect(() => {
    setOverviewSection("");
  }, [overviewDepartment]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-lg font-semibold text-gray-800">Find employee details</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-col gap-2 text-sm text-gray-600 md:max-w-[180px]">
              Factory
              <select
                className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={factoryId}
                onChange={(event) => setFactoryId(Number(event.target.value) as 1 | 2 | 3 | 4)}
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
                <option value="">Select employee</option>
                {people.map((person) => (
                  <option key={person.empId} value={person.empId}>
                    {person.empId} — {person.name || "Unknown"}
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
            <div className="mt-4 text-sm text-gray-500">Loading…</div>
          ) : selectedPerson ? (
            <div className="grid gap-4 text-sm text-gray-700">
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-lg font-semibold text-indigo-700">
                    {getInitial(ปกติizeValue(selectedPerson.Name)) || "?"}
                  </div>
                  <div>
                    <div className="text-xs text-indigo-500">พนักงานที่เลือก</div>
                    <div className="text-base font-semibold text-gray-900">
                      {ปกติizeValue(selectedPerson.Name) || "Unknown"}
                    </div>
                    <div className="text-sm text-gray-600">
                      {ปกติizeValue(selectedPerson.Position)} · {ปกติizeValue(selectedPerson.Department)}
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
                    ผลตรวจการมองเห็นระยะไกล {resultYear ? `(${resultYear})` : ""}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Year
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
                      value={resultYear}
                      onChange={(event) => setResultYear(event.target.value)}
                    >
                      {selectedEmpAvailableYears.map((year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-4 space-y-3 text-sm text-gray-700">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <div className="text-xs uppercase text-gray-500">Result</div>
                    <div className={`mt-2 ${getStatusClass(vaResult)}`}>{vaResult || "—"}</div>
                  </div>
                  {vaTrend.length ? (
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs uppercase text-gray-500">Trend by year</div>
                      <div className="mt-3 h-36">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={vaTrend} margin={{ top: 8, right: 36, left: 0, bottom: 0 }}>
                            <XAxis dataKey="year" />
                            <YAxis
                              domain={[0, 1.35]}
                              ticks={[0.2, 1]}
                              tickFormatter={(value) => (value >= 1 ? "ผิดปกติ" : "ปกติ")}
                            />
                            <Tooltip
                              formatter={(value) => {
                                const numeric = typeof value === "number" ? value : Number.NaN;
                                if (!Number.isFinite(numeric)) return "-";
                                return numeric >= 1 ? "ผิดปกติ" : "ปกติ";
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#2563EB"
                              strokeWidth={2}
                              connectNulls={false}
                              dot={({ cx, cy, payload }) => {
                                const raw = payload?.value;
                                const value = typeof raw === "number" ? raw : Number.NaN;
                                if (!Number.isFinite(value)) return null;
                                const isผิดปกติ = value >= 1;
                                return renderTrendDotWithLabel(cx, cy, isผิดปกติ);
                              }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Select an employee to see details.</div>
          )}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-lg font-semibold text-gray-800">ภาพรวม</div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-lg font-semibold text-gray-800">ภาพรวมตรวจวัดสายตา (VA)</div>
              <label className="flex items-center gap-2 text-sm text-gray-600">
                Year
                <select
                  className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                  value={selectedYear}
                  onChange={(event) => setSelectedYear(event.target.value)}
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-xs text-gray-600">
                Factory
                <select
                  className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                  value={overviewFactory}
                  onChange={(event) => setOverviewFactory(event.target.value)}
                >
                  <option value="">All</option>
                  <option value="1">TS</option>
                  <option value="2">TL</option>
                  <option value="3">KK</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs text-gray-600">
                Department
                <select
                  className="h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                  value={overviewDepartment}
                  onChange={(event) => setOverviewDepartment(event.target.value)}
                >
                  <option value="">All</option>
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
                  <option value="">All</option>
                  {overviewSectionOptions.map((section) => (
                    <option key={section} value={section}>
                      {section}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {overviewCharts.map((chart) => (
                <div key={chart.key} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-semibold text-gray-700">{getChartTitle(chart)}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                        ผิดปกติ: {chart.totals.ผิดปกติ}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        ปกติ: {chart.totals.ปกติ}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-60">
                    {chart.data.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        {shouldShowPieForChart(chart.key) || chart.data.length === 1 ? (
                          <PieChart>
                            <Pie
                              data={[
                                { name: "ปกติ", value: chart.totals.ปกติ },
                                { name: "ผิดปกติ", value: chart.totals.ผิดปกติ },
                              ]}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={85}
                              label={({ value }) => (typeof value === "number" && value > 0 ? `${value}` : "")}
                            >
                              <Cell fill="#16A34A" />
                              <Cell fill="#DC2626" />
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        ) : (
                          <BarChart data={chart.data}>
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="ผิดปกติ" name="ผิดปกติ" fill="#DC2626" stackId="status" />
                            <Bar dataKey="ปกติ" name="ปกติ" fill="#16A34A" stackId="status" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-gray-500">
                        No grouped data
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="text-xs text-gray-500">
          <Link href="/admin/health-check/health-risk" className="hover:underline">
            Back to Health Risk
          </Link>
        </div>
      </main>
    </div>
  );
}

