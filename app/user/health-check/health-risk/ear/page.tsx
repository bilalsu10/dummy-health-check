"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import {
  Line,
  LineChart,
  Label,
  Legend,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

const VISION_HEARING_KEYS = ["ตรวจสมรรถภาพการได้ยิน"];

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const HEARING_FREQ_LABELS = ["500", "1000", "2000", "3000", "4000", "6000", "8000"];
const GROUP_FIELDS = [
  { label: "Division", key: "Division" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const parseHearingValues = (value: unknown) => {
  const raw = normalizeValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
};

const YEAR_ORDER = ["2566", "2567", "2568"];

const resolveHearingStatus = (values: number[]) => {
  if (!values.length) return "unknown";
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  return avg > 25 ? "abnormal" : "normal";
};

export default function EyesReport() {
  const [rowsByYear, setRowsByYear] = useState<Record<string, HealthRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedYear] = useState("2568");
  const [selectedGroupKey, setSelectedGroupKey] = useState("Division");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError(null);
        const [res2568, res2567, res2566] = await Promise.all([
          fetch("/data/final_2568.json", { cache: "no-store" }),
          fetch("/data/final_2567.json", { cache: "no-store" }),
          fetch("/data/final_2566.json", { cache: "no-store" }),
        ]);
        if (!res2568.ok || !res2567.ok || !res2566.ok) {
          throw new Error("Failed to load one or more year datasets");
        }
        const [data2568, data2567, data2566] = (await Promise.all([
          res2568.json(),
          res2567.json(),
          res2566.json(),
        ])) as [HealthRow[], HealthRow[], HealthRow[]];
        if (active) {
          setRowsByYear({
            "2568": Array.isArray(data2568) ? data2568 : [],
            "2567": Array.isArray(data2567) ? data2567 : [],
            "2566": Array.isArray(data2566) ? data2566 : [],
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
      .map((row) => ({
        empId: normalizeValue(row.SCG_EmpID),
        name: normalizeValue(row.Name),
        department: normalizeValue(row.Department),
      }))
      .filter((person) => person.empId);
  }, [rowsByYear, selectedYear]);

  const selectedPerson = useMemo(() => {
    if (!selectedEmpId) return null;
    return (
      rowsByYear[selectedYear]?.find((row) => normalizeValue(row.SCG_EmpID) === selectedEmpId) ??
      null
    );
  }, [rowsByYear, selectedEmpId, selectedYear]);

  const hearingCharts = useMemo(() => {
    if (!selectedPerson) {
      return { right: [], left: [] };
    }
    const getRow = (year: string) =>
      rowsByYear[year]?.find((row) => normalizeValue(row.SCG_EmpID) === selectedEmpId) ?? null;
    const values2568 = parseHearingValues(getRow("2568")?.["ตรวจสมรรถภาพการได้ยิน"]);
    const values2567 = parseHearingValues(getRow("2567")?.["ตรวจสมรรถภาพการได้ยิน"]);
    const values2566 = parseHearingValues(getRow("2566")?.["ตรวจสมรรถภาพการได้ยิน"]);

    const rightEar = {
      "2568": values2568.slice(0, 7),
      "2567": values2567.slice(0, 7),
      "2566": values2566.slice(0, 7),
    };
    const leftEar = {
      "2568": values2568.slice(7, 14),
      "2567": values2567.slice(7, 14),
      "2566": values2566.slice(7, 14),
    };
    return {
      right: HEARING_FREQ_LABELS.map((label, index) => ({
        name: label,
        y2568: rightEar["2568"][index] ?? null,
        y2567: rightEar["2567"][index] ?? null,
        y2566: rightEar["2566"][index] ?? null,
      })),
      left: HEARING_FREQ_LABELS.map((label, index) => ({
        name: label,
        y2568: leftEar["2568"][index] ?? null,
        y2567: leftEar["2567"][index] ?? null,
        y2566: leftEar["2566"][index] ?? null,
      })),
    };
  }, [rowsByYear, selectedEmpId, selectedPerson]);

  const individualCategoryTrends = useMemo(() => {
    if (!selectedEmpId) return [];
    return [
      { label: "Left ear low (500–3000)", indices: [7, 8, 9, 10] },
      { label: "Left ear high (4000–8000)", indices: [11, 12, 13] },
      { label: "Right ear low (500–3000)", indices: [0, 1, 2, 3] },
      { label: "Right ear high (4000–8000)", indices: [4, 5, 6] },
    ].map((category) => {
      const data = YEAR_ORDER.map((year) => {
        const row =
          rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
          null;
        const values = parseHearingValues(row?.["ตรวจสมรรถภาพการได้ยิน"]);
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

  const buildGroupCounts = (
    rows: HealthRow[],
    groupKey: string,
    indices: number[],
    label: string,
  ) => {
    const grouped = new Map<string, { normal: number; abnormal: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[groupKey]) || "Unspecified";
      const values = parseHearingValues(row["ตรวจสมรรถภาพการได้ยิน"]);
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
    return { label, data };
  };

  const groupCharts = useMemo(() => {
    const rows = rowsByYear[selectedYear] ?? [];
    return [
      buildGroupCounts(rows, selectedGroupKey, [0, 1, 2, 3], "Right ear low (500–3000)"),
      buildGroupCounts(rows, selectedGroupKey, [4, 5, 6], "Right ear high (4000–8000)"),
      buildGroupCounts(rows, selectedGroupKey, [7, 8, 9, 10], "Left ear low (500–3000)"),
      buildGroupCounts(rows, selectedGroupKey, [11, 12, 13], "Left ear high (4000–8000)"),
    ];
  }, [rowsByYear, selectedYear, selectedGroupKey]);

  return (
    <div className="min-h-screen bg-gray-50">


      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-sm font-semibold text-gray-700">
            Find employee details
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
            {selectedPerson && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 md:flex-1">
                <div className="font-semibold text-gray-900">
                  {normalizeValue(selectedPerson.Name) || "Unknown"}
                </div>
                <div className="text-xs text-gray-600">
                  {normalizeValue(selectedPerson.Position)} ·{" "}
                  {normalizeValue(selectedPerson.Department)}
                </div>
              </div>
            )}
          </div>
          {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm font-semibold text-gray-700">
              Hearing summary by group
            </div>
            <label className="flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center">
              Group by
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
          <div className="grid gap-4 lg:grid-cols-2">
            {groupCharts.map((chart) => (
              <div key={chart.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="text-xs uppercase text-gray-500">{chart.label}</div>
                <div className="mt-3 h-56">
                  {chart.data.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chart.data}>
                        <XAxis dataKey="name" />
                        <YAxis allowDecimals={false} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="normal" name="Normal" fill="#16A34A" stackId="status" />
                        <Bar dataKey="abnormal" name="Abnormal" fill="#DC2626" stackId="status" />
                      </BarChart>
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
        </section>

        <section className="rounded-2xl border bg-white p-6">
          <div className="text-sm font-semibold text-gray-700">Hearing Results</div>
          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading…</div>
          ) : selectedPerson ? (
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
                                stroke="#B07C2D"
                                strokeWidth={2}
                                dot={makeDot("#B07C2D")}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2567"
                                name="2567"
                                stroke="#2563EB"
                                strokeWidth={2}
                                dot={makeDot("#2563EB")}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2566"
                                name="2566"
                                stroke="#7C3AED"
                                strokeWidth={2}
                                dot={makeDot("#7C3AED")}
                              />
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
                                stroke="#4C7A5A"
                                strokeWidth={2}
                                dot={makeDot("#4C7A5A")}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2567"
                                name="2567"
                                stroke="#2563EB"
                                strokeWidth={2}
                                dot={makeDot("#2563EB")}
                              />
                              <Line
                                type="monotone"
                                dataKey="y2566"
                                name="2566"
                                stroke="#7C3AED"
                                strokeWidth={2}
                                dot={makeDot("#7C3AED")}
                              />
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
          ) : (
            <div className="mt-4 text-sm text-gray-500">Select an employee to see details.</div>
          )}
        </section>
      </main>
    </div>
  );
}
