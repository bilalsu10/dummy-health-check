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

const VISION_KEY = "ตรวจสายตาทางอาชีวอนามัย";
const GROUP_FIELDS = [
  { label: "Division", key: "Division" },
  { label: "Department", key: "Department" },
  { label: "Section", key: "Section" },
];
const VISION_HEADERS = [
  "การมองด้วย2ตา",
  "การมองภาพระยะไกลด้วยสองตา",
  "การมองภาพระยะไกลด้วยตาขวา",
  "การมองภาพระยะไกลด้วยตาซ้าย",
  "การมองภาพ3มิติ",
  "การมองจำแนกสี",
  "ความสมดุลกล้ามเนื้อตาระยะไกลแนวตั้ง",
  "ความสมดุลกล้ามเนื้อตาระยะไกลแนวนอน",
  "การมองภาพระยะใกล้ด้วยสองตา",
  "การมองภาพระยะใกล้ด้วยตาขวา",
  "การมองภาพระยะใกล้ด้วยตาซ้าย",
  "ความสมดุลกล้ามเนื้อตาระยะใกล้แนวตั้ง",
  "ความสมดุลกล้ามเนื้อตาระยะใกล้แนวนอน",
  "ลานสายตา",
  "สรุปผลการตรวจ",
];

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const parseVisionItems = (value: unknown) => {
  const raw = normalizeValue(value);
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
};

const classifyVision = (value: string) => {
  if (!value) return null;
  if (value.includes("ผิดปกติ")) return "abnormal";
  if (value.includes("ไม่ชัดเจน")) return "abnormal";
  if (value.includes("ปกติ")) return "normal";
  return null;
};

const getVisionStatus = (value: string) => {
  if (value.includes("ผิดปกติ") || value.includes("ไม่ชัดเจน")) return "abnormal";
  if (value.includes("ปกติ") || value.includes("ชัดเจน")) return "normal";
  return "unknown";
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

  const visionItems = useMemo(() => {
    if (!selectedPerson) return [];
    return parseVisionItems(selectedPerson[VISION_KEY]);
  }, [selectedPerson]);

  const visionRecommendation = useMemo(() => {
    if (visionItems.length < 1) return "";
    return visionItems[visionItems.length - 1] ?? "";
  }, [visionItems]);

  const visionStatusItems = useMemo(() => {
    if (visionItems.length <= 2) return visionItems.slice(0, Math.max(0, visionItems.length - 2));
    return visionItems.slice(0, -2);
  }, [visionItems]);

  const categoryStatus = useMemo(() => {
    const resolveStatus = (values: string[]) => {
      if (values.some((value) => getVisionStatus(value) === "abnormal")) return "abnormal";
      if (values.some((value) => getVisionStatus(value) === "normal")) return "normal";
      return "unknown";
    };
    return {
      far: resolveStatus(visionStatusItems.slice(0, 6)),
      near: resolveStatus(visionStatusItems.slice(6, 11)),
      other: resolveStatus(visionStatusItems.slice(11, 14)),
    };
  }, [visionStatusItems]);

  const individualTrends = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2566", "2567", "2568"];
    const resolveStatus = (values: string[]) => {
      if (values.some((value) => getVisionStatus(value) === "abnormal")) return 1;
      if (values.some((value) => getVisionStatus(value) === "normal")) return 0.2;
      return null;
    };
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const values = parseVisionItems(row?.[VISION_KEY]);
      return {
        year,
        far: resolveStatus(values.slice(0, 6)),
        near: resolveStatus(values.slice(6, 11)),
        other: resolveStatus(values.slice(11, 14)),
      };
    });
  }, [rowsByYear, selectedEmpId]);

  const buildGroupChart = (indices: number[]) => {
    const rows = rowsByYear[selectedYear] ?? [];
    const grouped = new Map<string, { normal: number; abnormal: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[selectedGroupKey]) || "Unspecified";
      const values = parseVisionItems(row[VISION_KEY]);
      if (!values.length) return;
      const selected = indices.map((idx) => values[idx]).filter(Boolean);
      if (!selected.length) return;
      const status = selected.some((value) => getVisionStatus(value) === "abnormal")
        ? "abnormal"
        : selected.some((value) => getVisionStatus(value) === "normal")
          ? "normal"
          : "unknown";
      if (status === "unknown") return;
      if (!grouped.has(groupName)) {
        grouped.set(groupName, { normal: 0, abnormal: 0 });
      }
      grouped.get(groupName)![status] += 1;
    });
    return Array.from(grouped.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.normal + b.abnormal - (a.normal + a.abnormal));
  };

  const groupCharts = useMemo(() => {
    return [
      { label: "ตรวจสายตาระยะไกล", data: buildGroupChart([0, 1, 2, 3, 4, 5]) },
      { label: "ตรวจสายตาระยะใกล้", data: buildGroupChart([6, 7, 8, 9, 10]) },
      { label: "ตรวจสายตาอื่นๆ", data: buildGroupChart([11, 12, 13]) },
    ];
  }, [rowsByYear, selectedYear, selectedGroupKey]);

  const groupTotals = useMemo(() => {
    return groupCharts.map((chart) => {
      const totals = chart.data.reduce(
        (acc, item) => {
          acc.normal += item.normal ?? 0;
          acc.abnormal += item.abnormal ?? 0;
          return acc;
        },
        { normal: 0, abnormal: 0 },
      );
      return { ...chart, totals };
    });
  }, [groupCharts]);

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
              Vision summary by group
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
          <div className="grid gap-4">
            {groupTotals.map((chart) => (
              <div key={chart.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs uppercase text-gray-500">{chart.label}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                      Normal: {chart.totals.normal}
                    </span>
                    <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-red-700">
                      Abnormal: {chart.totals.abnormal}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-52">
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
          <div className="text-sm font-semibold text-gray-700">Vision Results</div>
          {loading ? (
            <div className="mt-4 text-sm text-gray-500">Loading…</div>
          ) : selectedPerson ? (
            <div className="mt-4 space-y-4 text-sm text-gray-700">
              {visionStatusItems.length ? (
                <div className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-sky-100 text-gray-800">
                          <th
                            className="border border-sky-200 p-2 text-left text-sm font-semibold"
                            colSpan={6}
                          >
                            ตรวจสายตาระยะไกล
                          </th>
                        </tr>
                        <tr className="bg-sky-50 text-gray-800">
                          {VISION_HEADERS.slice(0, 6).map((header) => (
                            <th key={header} className="border border-sky-200 p-2 text-center">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {VISION_HEADERS.slice(0, 6).map((_, index) => (
                            <td
                              key={`value-far-${index}`}
                              className="border border-sky-200 p-2 text-center"
                            >
                            {(() => {
                              const value = visionStatusItems[index] ?? "—";
                              const status = getVisionStatus(String(value));
                              return (
                                <span
                                  className={
                                    status === "abnormal"
                                      ? "font-semibold text-red-600"
                                      : status === "normal"
                                        ? "font-semibold text-emerald-600"
                                        : ""
                                  }
                                >
                                  {value}
                                </span>
                              );
                            })()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[680px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-sky-100 text-gray-800">
                          <th
                            className="border border-sky-200 p-2 text-left text-sm font-semibold"
                            colSpan={5}
                          >
                            ตรวจสายตาระยะใกล้
                          </th>
                        </tr>
                        <tr className="bg-sky-50 text-gray-800">
                          {VISION_HEADERS.slice(6, 11).map((header) => (
                            <th key={header} className="border border-sky-200 p-2 text-center">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {VISION_HEADERS.slice(6, 11).map((_, index) => (
                            <td
                              key={`value-near-${index}`}
                              className="border border-sky-200 p-2 text-center"
                            >
                              {(() => {
                                const value = visionStatusItems[index + 6] ?? "—";
                                const status = getVisionStatus(String(value));
                                return (
                                  <span
                                    className={
                                      status === "abnormal"
                                        ? "font-semibold text-red-600"
                                        : status === "normal"
                                          ? "font-semibold text-emerald-600"
                                          : ""
                                    }
                                  >
                                    {value}
                                  </span>
                                );
                              })()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[520px] border-collapse text-xs">
                      <thead>
                        <tr className="bg-sky-100 text-gray-800">
                          <th
                            className="border border-sky-200 p-2 text-left text-sm font-semibold"
                            colSpan={3}
                          >
                            ตรวจสายตาอื่นๆ
                          </th>
                        </tr>
                        <tr className="bg-sky-50 text-gray-800">
                          {VISION_HEADERS.slice(11, 14).map((header) => (
                            <th key={header} className="border border-sky-200 p-2 text-center">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          {VISION_HEADERS.slice(11, 14).map((_, index) => (
                            <td
                              key={`value-other-${index}`}
                              className="border border-sky-200 p-2 text-center"
                            >
                              {(() => {
                                const value = visionStatusItems[index + 11] ?? "—";
                                const status = getVisionStatus(String(value));
                                return (
                                  <span
                                    className={
                                      status === "abnormal"
                                        ? "font-semibold text-red-600"
                                        : status === "normal"
                                          ? "font-semibold text-emerald-600"
                                          : ""
                                    }
                                  >
                                    {value}
                                  </span>
                                );
                              })()}
                            </td>
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <span className="text-sm text-gray-500">No vision values</span>
              )}
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  { label: "ตรวจสายตาระยะไกล", status: categoryStatus.far },
                  { label: "ตรวจสายตาระยะใกล้", status: categoryStatus.near },
                  { label: "ตรวจสายตาอื่นๆ", status: categoryStatus.other },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
                  >
                    <div className="text-xs uppercase text-sky-700">{item.label}</div>
                    <div
                      className={`mt-2 ${
                        item.status === "abnormal"
                          ? "font-semibold text-red-600"
                          : item.status === "normal"
                            ? "font-semibold text-emerald-600"
                            : ""
                      }`}
                    >
                      {item.status === "abnormal"
                        ? "ผิดปกติ"
                        : item.status === "normal"
                          ? "ปกติ"
                          : "—"}
                    </div>
                  </div>
                ))}
              </div>
              {visionRecommendation && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="text-xs uppercase text-amber-700">Recommendation</div>
                  <div className="mt-2">{visionRecommendation}</div>
                </div>
              )}
              {individualTrends.length ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  {[
                    { key: "far", label: "ตรวจสายตาระยะไกล" },
                    { key: "near", label: "ตรวจสายตาระยะใกล้" },
                    { key: "other", label: "ตรวจสายตาอื่นๆ" },
                  ].map((series) => {
                    const hasAbnormal = individualTrends.some(
                      (item) => Number(item[series.key as keyof typeof item]) >= 1,
                    );
                    return (
                    <div
                      key={series.key}
                      className="rounded-xl border border-gray-200 bg-white p-4"
                    >
                      <div className="text-xs uppercase text-gray-500">{series.label}</div>
                      <div className="mt-3 h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={individualTrends}>
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
                              dataKey={series.key}
                              stroke={hasAbnormal ? "#DC2626" : "#2563EB"}
                              strokeWidth={2}
                              connectNulls
                              dot={({ cx, cy, payload }) => {
                                const value = Number(
                                  payload?.[series.key as keyof typeof payload] ?? 0,
                                );
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
                  );
                  })}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 text-sm text-gray-500">Select an employee to see details.</div>
          )}
        </section>
      </main>
    </div>
  );
}
