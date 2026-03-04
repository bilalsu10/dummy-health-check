"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { getDatasetPath } from "@/lib/dataPath";
import {
  Line,
  LineChart,
  Label,
  Legend,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

const VISION_HEARING_KEYS = ["Hearing Test"];
const HEARING_KEYS = ["Hearing Test", "ตรวจสมรรถภาพการได้ยิน"];

const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const HEARING_FREQ_LABELS = ["500", "1000", "2000", "3000", "4000", "6000", "8000"];
const OVERVIEW_GROUPS = [
  { label: "Factory", key: "Factory" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const parseHearingValues = (value: unknown) => {
  const raw = normalizeValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "" && part !== "-" && part.toLowerCase() !== "null")
    .map((part) => Number(part))
    .filter((number) => Number.isFinite(number));
};

const getHearingRawValue = (row: HealthRow | null) => {
  if (!row) return "";
  for (const key of HEARING_KEYS) {
    const value = normalizeValue(row[key]);
    if (value) return value;
  }
  return "";
};

const YEAR_ORDER_ALL = ["2565", "2566", "2567", "2568"];
const YEAR_COLORS = {
  "2568": "#B07C2D",
  "2567": "#2563EB",
  "2566": "#7C3AED",
  "2565": "#0EA5E9",
};

const resolveHearingStatus = (values: number[]) => {
  if (!values.length) return "unknown";
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return avg > 25 ? "abnormal" : "normal";
};

export default function EyesReport() {
  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factoryId, setFactoryId] = useState<1 | 2 | 3>(1);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [overviewFactory, setOverviewFactory] = useState<string>("");
  const [overviewDepartment, setOverviewDepartment] = useState<string>("");
  const [overviewSection, setOverviewSection] = useState<string>("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resAll = await fetch(getDatasetPath("ALL/all.json"), { cache: "no-store" });
        if (!resAll.ok) {
          throw new Error("Failed to load dataset");
        }
        const dataAll = (await resAll.json()) as HealthRow[];
        const allRows = Array.isArray(dataAll) ? dataAll : [];
        const rows2568 = allRows.filter((row) => String(row.Year) === "2568");
        const rows2567 = allRows.filter((row) => String(row.Year) === "2567");
        const rows2566 = allRows.filter((row) => String(row.Year) === "2566");
        const rows2565 = allRows.filter((row) => String(row.Year) === "2565");
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

  const availableYears = useMemo(() => {
    return YEAR_ORDER_ALL.filter((year) =>
      (rowsByYear[year] ?? []).some((row) => parseHearingValues(getHearingRawValue(row)).length > 0),
    );
  }, [rowsByYear]);

  useEffect(() => {
    setSelectedEmpId("");
  }, [factoryId]);

  useEffect(() => {
    if (!availableYears.length) {
      setSelectedYear("");
      return;
    }
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[availableYears.length - 1]);
    }
  }, [availableYears, selectedYear]);

  const people = useMemo(() => {
    if (!selectedYear) return [];
    const baseRows = rowsByYear[selectedYear] ?? [];
    return baseRows
      .filter((row) => Number(row.FactoryId) === factoryId)
      .map((row) => ({
        empId: normalizeValue(row.SCG_EmpID),
        name: normalizeValue(row.Name),
        department: normalizeValue(row.Department),
      }))
      .filter((person) => person.empId);
  }, [rowsByYear, selectedYear]);

  const selectedPerson = useMemo(() => {
    if (!selectedEmpId) return null;
    if (!selectedYear) return null;
    return (
      rowsByYear[selectedYear]?.find(
        (row) => normalizeValue(row.SCG_EmpID) === selectedEmpId && Number(row.FactoryId) === factoryId,
      ) ??
      null
    );
  }, [rowsByYear, selectedEmpId, selectedYear, factoryId]);

  const hearingCharts = useMemo(() => {
    if (!selectedPerson) {
      return { right: [], left: [] };
    }
    const getRow = (year: string) =>
      rowsByYear[year]?.find((row) => normalizeValue(row.SCG_EmpID) === selectedEmpId) ?? null;
    const values2568 = parseHearingValues(getHearingRawValue(getRow("2568")));
    const values2567 = parseHearingValues(getHearingRawValue(getRow("2567")));
    const values2566 = parseHearingValues(getHearingRawValue(getRow("2566")));
    const values2565 = parseHearingValues(getHearingRawValue(getRow("2565")));

    const rightEar = {
      "2568": values2568.slice(0, 7),
      "2567": values2567.slice(0, 7),
      "2566": values2566.slice(0, 7),
      "2565": values2565.slice(0, 7),
    };
    const leftEar = {
      "2568": values2568.slice(7, 14),
      "2567": values2567.slice(7, 14),
      "2566": values2566.slice(7, 14),
      "2565": values2565.slice(7, 14),
    };
    return {
      right: HEARING_FREQ_LABELS.map((label, index) => ({
        name: label,
        y2568: rightEar["2568"][index] ?? null,
        y2567: rightEar["2567"][index] ?? null,
        y2566: rightEar["2566"][index] ?? null,
        y2565: rightEar["2565"][index] ?? null,
      })),
      left: HEARING_FREQ_LABELS.map((label, index) => ({
        name: label,
        y2568: leftEar["2568"][index] ?? null,
        y2567: leftEar["2567"][index] ?? null,
        y2566: leftEar["2566"][index] ?? null,
        y2565: leftEar["2565"][index] ?? null,
      })),
    };
  }, [rowsByYear, selectedEmpId, selectedPerson]);

  const individualCategoryTrends = useMemo(() => {
    if (!selectedEmpId) return [];
    const yearOrder = factoryId === 1 ? YEAR_ORDER_ALL : YEAR_ORDER_ALL.slice(1);
    return [
      { label: "Left ear low (500–3000)", indices: [7, 8, 9, 10] },
      { label: "Left ear high (4000–8000)", indices: [11, 12, 13] },
      { label: "Right ear low (500–3000)", indices: [0, 1, 2, 3] },
      { label: "Right ear high (4000–8000)", indices: [4, 5, 6] },
    ].map((category) => {
      const data = yearOrder.map((year) => {
        const row =
          rowsByYear[year]?.find(
            (item) => normalizeValue(item.SCG_EmpID) === selectedEmpId && Number(item.FactoryId) === factoryId,
          ) ??
          null;
        const values = parseHearingValues(getHearingRawValue(row));
        const selected = category.indices.map((idx) => values[idx]).filter((val) => val != null);
        const status = resolveHearingStatus(selected as number[]);
        return {
          year,
          normal: status === "normal" ? 1 : null,
          abnormal: status === "abnormal" ? 1 : null,
        };
      });
      return { label: category.label, data };
    });
  }, [rowsByYear, selectedEmpId]);

  const makeDot = (baseColor: string) => {
    return (props: any): React.ReactNode => {
      const { cx, cy, payload, dataKey } = props;
      const raw = payload && dataKey ? payload[dataKey] : null;
      const value = Number(raw ?? 0);
      const isHigh = value > 25;
      return (
        <circle
          key={`dot-${cx}-${cy}`}
          cx={cx}
          cy={cy}
          r={isHigh ? 7 : 4}
          fill={isHigh ? "#DC2626" : baseColor}
          stroke={isHigh ? "#7F1D1D" : "transparent"}
          strokeWidth={isHigh ? 2 : 0}
        />
      );
    };
  };

  const show2565 = factoryId === 1;

  const overviewRowsYear = useMemo(() => rowsByYear[selectedYear] ?? [], [rowsByYear, selectedYear]);

  const overviewDepartmentOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? String(row.FactoryId) === overviewFactory : true))
          .map((row) => normalizeValue(row.Department))
          .filter((value) => value && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear, overviewFactory]);

  const overviewSectionOptions = useMemo(() => {
    return Array.from(
      new Set(
        overviewRowsYear
          .filter((row) => (overviewFactory ? String(row.FactoryId) === overviewFactory : true))
          .filter((row) => (overviewDepartment ? normalizeValue(row.Department) === overviewDepartment : true))
          .map((row) => normalizeValue(row.Section))
          .filter((value) => value && value !== "-"),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [overviewRowsYear, overviewFactory, overviewDepartment]);

  const getRowsForGroupChart = (groupKey: string) => {
    if (groupKey === "Factory") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && String(row.FactoryId) !== overviewFactory) return false;
        return true;
      });
    }
    if (groupKey === "Department") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && String(row.FactoryId) !== overviewFactory) return false;
        if (overviewDepartment && normalizeValue(row.Department) !== overviewDepartment) return false;
        return true;
      });
    }
    if (groupKey === "Section") {
      return overviewRowsYear.filter((row) => {
        if (overviewFactory && String(row.FactoryId) !== overviewFactory) return false;
        if (overviewDepartment && normalizeValue(row.Department) !== overviewDepartment) return false;
        if (overviewSection && normalizeValue(row.Section) !== overviewSection) return false;
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

  const buildGroupCounts = (groupKey: string, indices: number[]) => {
    const rows = getRowsForGroupChart(groupKey);
    const grouped = new Map<string, { normal: number; abnormal: number }>();
    const toFactoryLabel = (id: number) => {
      if (id === 1) return "TS";
      if (id === 2) return "TL";
      if (id === 3) return "KK";
      return "Unspecified";
    };
    rows.forEach((row) => {
      const groupName =
        groupKey === "Factory"
          ? toFactoryLabel(Number(row.FactoryId))
          : normalizeValue(row[groupKey]) || "Unspecified";
      const values = parseHearingValues(getHearingRawValue(row));
      if (!values.length) return;
      const selected = indices.map((idx) => values[idx]).filter((val) => Number.isFinite(val));
      if (!selected.length) return;
      const avg = selected.reduce((sum, val) => sum + val, 0) / selected.length;
      const bucket = avg > 25 ? "abnormal" : "normal";
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { normal: 0, abnormal: 0 });
      }
      grouped.get(groupName)![bucket] += 1;
    });
    const data = Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.normal + b.abnormal - (a.normal + a.abnormal));
    const totals = data.reduce(
      (acc, item) => {
        acc.normal += item.normal ?? 0;
        acc.abnormal += item.abnormal ?? 0;
        return acc;
      },
      { normal: 0, abnormal: 0 },
    );
    return { data, totals };
  };

  const groupCharts = useMemo(() => {
    return [
      { label: "Right ear low (500–3000)", indices: [0, 1, 2, 3] },
      { label: "Right ear high (4000–8000)", indices: [4, 5, 6] },
      { label: "Left ear low (500–3000)", indices: [7, 8, 9, 10] },
      { label: "Left ear high (4000–8000)", indices: [11, 12, 13] },
    ].map((section) => ({
      ...section,
      charts: OVERVIEW_GROUPS.map((group) => ({
        ...group,
        ...buildGroupCounts(group.key, section.indices),
      })),
      totals: OVERVIEW_GROUPS.reduce(
        (acc, group) => {
          const t = buildGroupCounts(group.key, section.indices).totals;
          acc.normal += t.normal;
          acc.abnormal += t.abnormal;
          return acc;
        },
        { normal: 0, abnormal: 0 },
      ),
    }));
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
          <div className="mb-3 text-lg font-semibold text-gray-800">
            Find employee details
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="flex flex-col gap-2 text-sm text-gray-600 md:max-w-[180px]">
              Factory
              <select
                className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900"
                value={factoryId}
                onChange={(event) => setFactoryId(Number(event.target.value) as 1 | 2 | 3)}
              >
                <option value={1}>TS</option>
                <option value={2}>TL</option>
                <option value={3}>KK</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-gray-600 md:max-w-sm md:flex-1">
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
                    {getInitial(normalizeValue(selectedPerson.Name)) || "?"}
                  </div>
                  <div>
                    <div className="text-xs text-indigo-500">พนักงานที่เลือก</div>
                    <div className="text-base font-semibold text-gray-900">
                      {normalizeValue(selectedPerson.Name) || "Unknown"}
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
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-lg font-semibold text-gray-800">
                    Hearing Results {selectedYear ? `(${selectedYear})` : ""}
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    Year
                    <select
                      className="h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-900"
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
                <div className="mt-4 space-y-6 text-sm text-gray-700">
              {VISION_HEARING_KEYS.map((item) => (
                <div key={item} className="space-y-4">
                  <div className="text-sm text-gray-600">{item}</div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs uppercase text-gray-500">Left ear</div>
                      <div className="mt-3 h-48">
                        {hearingCharts.left.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={hearingCharts.left}>
                              <XAxis dataKey="name">
                                <Label
                                  value="Frequency (Hz)"
                                  position="insideBottom"
                                  offset={-2}
                                  style={{ fontSize: 10, fill: "#6B7280" }}
                                />
                              </XAxis>
                              <YAxis domain={[0, 40]} />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="y2568"
                                name="2568"
                                stroke={YEAR_COLORS["2568"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2568"])}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2567"
                                name="2567"
                                stroke={YEAR_COLORS["2567"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2567"])}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2566"
                                name="2566"
                                stroke={YEAR_COLORS["2566"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2566"])}
                              />
                              {show2565 && (
                                <Line
                                  type="monotone"
                                  dataKey="y2565"
                                  name="2565"
                                  stroke={YEAR_COLORS["2565"]}
                                  strokeWidth={2}
                                  dot={makeDot(YEAR_COLORS["2565"])}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-500">
                            No left-ear values
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs uppercase text-gray-500">Right ear</div>
                      <div className="mt-3 h-48">
                        {hearingCharts.right.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={hearingCharts.right}>
                              <XAxis dataKey="name">
                                <Label
                                  value="Frequency (Hz)"
                                  position="insideBottom"
                                  offset={-2}
                                  style={{ fontSize: 10, fill: "#6B7280" }}
                                />
                              </XAxis>
                              <YAxis domain={[0, 40]} />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="y2568"
                                name="2568"
                                stroke={YEAR_COLORS["2568"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2568"])}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2567"
                                name="2567"
                                stroke={YEAR_COLORS["2567"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2567"])}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2566"
                                name="2566"
                                stroke={YEAR_COLORS["2566"]}
                                strokeWidth={2}
                                dot={makeDot(YEAR_COLORS["2566"])}
                              />
                              {show2565 && (
                                <Line
                                  type="monotone"
                                  dataKey="y2565"
                                  name="2565"
                                  stroke={YEAR_COLORS["2565"]}
                                  strokeWidth={2}
                                  dot={makeDot(YEAR_COLORS["2565"])}
                                />
                              )}
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-gray-500">
                            No right-ear values
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {individualCategoryTrends.map((chart) => (
                      <div key={chart.label} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="text-xs uppercase text-gray-500">{chart.label}</div>
                        <div className="mt-3 h-40">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chart.data}>
                              <XAxis dataKey="year" />
                              <YAxis
                                allowDecimals={false}
                                ticks={[0, 1]}
                                domain={[0, 1]}
                              />
                              <Tooltip />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="normal"
                                name="Normal"
                                stroke="#16A34A"
                                strokeWidth={2}
                              />
                              <Line
                                type="monotone"
                                dataKey="abnormal"
                                name="Abnormal"
                                stroke="#DC2626"
                                strokeWidth={2}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
              <div className="text-lg font-semibold text-gray-800">
                Hearing summary by group
              </div>
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
            <div className="grid gap-4">
              {groupCharts.map((chart) => (
                <div key={chart.label} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs uppercase text-gray-500">{chart.label}</div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                        Abnormal: {chart.totals.abnormal}
                      </span>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                        Normal: {chart.totals.normal}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-4 lg:grid-cols-3">
                    {chart.charts.map((subChart) => (
                      <div key={`${chart.label}-${subChart.key}`} className="rounded-xl border border-gray-200 bg-white p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-semibold text-gray-700">{subChart.label}</div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                              Abnormal: {subChart.totals.abnormal}
                            </span>
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                              Normal: {subChart.totals.normal}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 h-56">
                          {subChart.data.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                              {shouldShowPieForChart(subChart.key) || subChart.data.length === 1 ? (
                                <PieChart>
                                  <Pie
                                    data={[
                                      { name: "Normal", value: subChart.totals.normal },
                                      { name: "Abnormal", value: subChart.totals.abnormal },
                                    ]}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={85}
                                    label={({ value }) =>
                                      typeof value === "number" && value > 0 ? `${value}` : ""
                                    }
                                  >
                                    <Cell fill="#16A34A" />
                                    <Cell fill="#DC2626" />
                                  </Pie>
                                  <Tooltip />
                                  <Legend />
                                </PieChart>
                              ) : (
                                <BarChart data={subChart.data}>
                                  <XAxis dataKey="name" />
                                  <YAxis allowDecimals={false} />
                                  <Tooltip />
                                  <Legend />
                                  <Bar dataKey="abnormal" name="Abnormal" fill="#DC2626" stackId="status" />
                                  <Bar dataKey="normal" name="Normal" fill="#16A34A" stackId="status" />
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
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
