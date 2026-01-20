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

const VA_KEY = "ตรวจการมองเห็นระยะไกล";
const GROUP_FIELDS = [
  { label: "Division", key: "Division" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];

const normalizeValue = (value: unknown) => String(value ?? "").trim();
const getInitial = (value: string) => value.replace(/\s+/g, "").slice(0, 1);

const parseItems = (value: unknown) => {
  const raw = normalizeValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const getVisionStatus = (value: string) => {
  if (value.includes("ผิดปกติ") || value.includes("ไม่ชัดเจน")) return "abnormal";
  if (value.includes("ปกติ") || value.includes("ชัดเจน")) return "normal";
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

export default function EyesVaReport() {
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

  const vaItems = useMemo(() => {
    if (!selectedPerson) return [];
    return parseItems(selectedPerson[VA_KEY]);
  }, [selectedPerson]);

  const vaResult = vaItems[0] ?? "";

  const vaTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2566", "2567", "2568"];
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const items = parseItems(row?.[VA_KEY]);
      const status = getVaStatusValue(items[0] ?? "");
      return { year, value: status };
    });
  }, [rowsByYear, selectedEmpId]);

  const groupChart = useMemo(() => {
    const rows = rowsByYear[selectedYear] ?? [];
    const grouped = new Map<string, { normal: number; abnormal: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[selectedGroupKey]) || "Unspecified";
      const status = getVisionStatus(normalizeValue(row[VA_KEY]));
      if (status === "unknown") return;
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { normal: 0, abnormal: 0 });
      }
      grouped.get(groupName)![status] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.normal + b.abnormal - (a.normal + a.abnormal));
  }, [rowsByYear, selectedYear, selectedGroupKey]);

  const groupTotals = useMemo(() => {
    return groupChart.reduce(
      (acc, item) => {
        acc.normal += item.normal ?? 0;
        acc.abnormal += item.abnormal ?? 0;
        return acc;
      },
      { normal: 0, abnormal: 0 },
    );
  }, [groupChart]);
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-lg font-semibold text-gray-800">
            Find employee details
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
                <div className="text-lg font-semibold text-gray-800">ผลตรวจการมองเห็นระยะไกล</div>
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
                          <LineChart data={vaTrend}>
                            <XAxis dataKey="year" />
                            <YAxis
                              domain={[0, 1.2]}
                              ticks={[0.2, 1]}
                              tickFormatter={(value) => (value >= 1 ? "Abnormal" : "Normal")}
                            />
                            <Tooltip
                              formatter={(value: number | null) =>
                                value != null && value >= 1 ? "Abnormal" : "Normal"
                              }
                            />
                            <Line
                              type="monotone"
                              dataKey="value"
                              stroke="#2563EB"
                              strokeWidth={2}
                              dot={({ cx, cy, payload }) => {
                                const value = Number(payload?.value ?? 0);
                                const isAbnormal = value >= 1;
                                return (
                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={isAbnormal ? 6 : 4}
                                    fill={isAbnormal ? "#DC2626" : "#2563EB"}
                                    stroke={isAbnormal ? "#7F1D1D" : "transparent"}
                                    strokeWidth={isAbnormal ? 2 : 0}
                                  />
                                );
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
              <div className="text-lg font-semibold text-gray-800">
                Vision VA summary by group
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
            <div className="mb-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                Normal: {groupTotals.normal}
              </span>
              <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                Abnormal: {groupTotals.abnormal}
              </span>
            </div>
            <div className="h-64">
              {groupChart.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupChart}>
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
        </section>

        <div className="text-xs text-gray-500">
          <Link href="/user/health-check/health-risk" className="hover:underline">
            Back to Health Risk
          </Link>
        </div>
      </main>
    </div>
  );
}
