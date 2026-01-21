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

const BP_KEY = "ความดันโลหิต";
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

export default function BloodPressureReport() {
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

  const selectedBp = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear["2568"]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = normalizeValue(row[BP_KEY]);
    const bucket = categorizeBp(raw);
    return { raw, bucket };
  }, [rowsByYear, selectedEmpId]);

  const bpTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2566", "2567", "2568"];
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const value = bpStatusValue(normalizeValue(row?.[BP_KEY]));
      return { year, value };
    });
  }, [rowsByYear, selectedEmpId]);

  const bpSummary2568 = useMemo(() => {
    const rows = rowsByYear["2568"] ?? [];
    const counts = { low: 0, normal: 0, high: 0, notTested: 0, other: 0 };
    rows.forEach((row) => {
      const bucket = categorizeBp(normalizeValue(row[BP_KEY]));
      counts[bucket] += 1;
    });
    return counts;
  }, [rowsByYear]);

  const groupChart = useMemo(() => {
    const rows = rowsByYear[selectedYear] ?? [];
    const grouped = new Map<string, { low: number; normal: number; high: number; notTested: number; other: number }>();
    rows.forEach((row) => {
      const groupName = normalizeValue(row[selectedGroupKey]) || "Unspecified";
      const bucket = categorizeBp(normalizeValue(row[BP_KEY]));
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
  }, [rowsByYear, selectedYear, selectedGroupKey]);

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-8">
        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-3 text-lg font-semibold text-gray-800">
            ค้นหาข้อมูลพนักงาน
          </div>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
                    {person.empId} — {person.name || "ไม่ทราบชื่อ"}
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
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  สรุปความดันโลหิตของพนักงาน (ปี 2568)
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-600">ผลตรวจ</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedBp?.raw || "—"}
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
                        domain={[0, 1.2]}
                        ticks={[0.2, 0.6, 1]}
                        tickFormatter={(value) =>
                          value >= 1 ? "สูง" : value >= 0.6 ? "ปกติ" : "ต่ำ"
                        }
                      />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#2563EB"
                        strokeWidth={2}
                        dot={{ r: 4 }}
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
          <div className="grid gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-4 text-lg font-semibold text-gray-800">
                สรุปความดันโลหิต ปี 2568
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs text-emerald-700">ปกติ</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">
                    {bpSummary2568.normal}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-xs text-red-700">ความดันสูง</div>
                  <div className="mt-2 text-2xl font-semibold text-red-900">
                    {bpSummary2568.high}
                  </div>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-xs text-yellow-700">ความดันต่ำ</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-900">
                    {bpSummary2568.low}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {bpSummary2568.notTested}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">อื่นๆ</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {bpSummary2568.other}
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
                    ไม่มีข้อมูลกลุ่ม
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
