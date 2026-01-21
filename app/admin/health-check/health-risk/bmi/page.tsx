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

const BMI_KEY = "ดัชนีมวลกาย";
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

export default function BmiReport() {
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

  const bmiTrend = useMemo(() => {
    if (!selectedEmpId) return [];
    const years = ["2566", "2567", "2568"];
    return years.map((year) => {
      const row =
        rowsByYear[year]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
        null;
      const value = parseBmiValue(row?.[BMI_KEY]);
      return { year, value };
    });
  }, [rowsByYear, selectedEmpId]);

  const selectedBmiSummary = useMemo(() => {
    if (!selectedEmpId) return null;
    const row =
      rowsByYear["2568"]?.find((item) => normalizeValue(item.SCG_EmpID) === selectedEmpId) ??
      null;
    if (!row) return null;
    const raw = normalizeValue(row[BMI_KEY]);
    const value = parseBmiValue(row[BMI_KEY]);
    const bucket = categorizeBmi(row[BMI_KEY]);
    return { raw, value, bucket };
  }, [rowsByYear, selectedEmpId]);

  const bmiSummary2568 = useMemo(() => {
    const rows = rowsByYear["2568"] ?? [];
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
  }, [rowsByYear]);

  const groupChart = useMemo(() => {
    const rows = rowsByYear[selectedYear] ?? [];
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
                <div className="mb-3 text-lg font-semibold text-gray-800">
                  สรุป BMI ของพนักงาน (ปี 2568)
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-xs text-slate-600">ค่า BMI</div>
                    <div className="mt-2 text-2xl font-semibold text-slate-900">
                      {selectedBmiSummary?.value != null ? selectedBmiSummary.value : "—"}
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
                <div className="mt-4 text-sm text-gray-500">Loading…</div>
              ) : selectedPerson ? (
                <div className="mt-4">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={bmiTrend}>
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name="BMI"
                          stroke="#2563EB"
                          strokeWidth={2}
                          dot={{ r: 4 }}
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
          <div className="grid gap-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-4 text-lg font-semibold text-gray-800">
                สรุป BMI ปี 2568
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-xs text-emerald-700">ปกติ</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-900">
                    {bmiSummary2568.counts.normal}
                  </div>
                </div>
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-xs text-orange-700">น้ำหนักเกินเกณฑ์</div>
                  <div className="mt-2 text-2xl font-semibold text-orange-900">
                    {bmiSummary2568.counts.overweight}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-xs text-red-700">อ้วน</div>
                  <div className="mt-2 text-2xl font-semibold text-red-900">
                    {bmiSummary2568.counts.obese}
                  </div>
                </div>
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <div className="text-xs text-yellow-700">น้ำหนักต่ำกว่าเกณฑ์</div>
                  <div className="mt-2 text-2xl font-semibold text-yellow-900">
                    {bmiSummary2568.counts.underweight}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="text-xs text-gray-600">ไม่ได้รับการตรวจ</div>
                  <div className="mt-2 text-2xl font-semibold text-gray-900">
                    {bmiSummary2568.counts.notTested}
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs text-slate-600">BMI เฉลี่ย (ปี 2568)</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {bmiSummary2568.average ?? "—"}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    จำนวนผู้มีค่า BMI: {bmiSummary2568.total}
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
