"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HealthRow = Record<string, unknown>;

type ChartDatum = {
  name: string;
  value: number;
};

type TestDatum = {
  name: string;
  normal: number;
  abnormal: number;
  notTested: number;
  other: number;
};

const BMI_KEY = "ดัชนีมวลกาย";
const BP_KEY = "ความดันโลหิต";

const DEMOGRAPHICS_KEYS = [
  "RowNo",
  "HN",
  "SCG_EmpID",
  "Name",
  "DOB",
  "Age",
  "Position",
  "Section",
  "Department",
  "Division",
];

const VITALS_KEYS = ["ดัชนีมวลกาย", "ความดันโลหิต", "ตรวจน้ำตาลในเลือด"];

const VISION_HEARING_KEYS = [
  "ตรวจสายตาทางอาชีวอนามัย",
  "ตรวจการมองเห็นระยะไกล",
  "ตรวจสมรรถภาพการได้ยิน",
];

const LAB_CHEMISTRY_KEYS = [
  "ตรวจการทำงานของตับ",
  "ตรวจการทำงานของไต",
  "ตรวจกรดยูริคในเลือด",
  "สารบ่งชี้มะเร็งต่อมลูกหมากในเลือด",
];

const HEMATOLOGY_KEYS = ["ตรวจความสมบูรณ์ของเม็ดเลือด"];

const STOOL_KEYS = ["ตรวจอุจจาระ"];

const IMAGING_FUNCTIONAL_KEYS = [
  "ตรวจคลื่นไฟฟ้าหัวใจ",
  "ตรวจสมรรถภาพปอด",
  "ตรวจเอ็กซเรย์ปอด",
];

const URINE_KEYS = [
  "ตรวจปัสสาวะสมบูรณ์แบบ",
  "ตรวจสารหนูในปัสสาวะ",
  "ตรวจสารอะซิโตนในปัสสาวะ",
  "ตรวจสารปรอทในปัสสาวะ",
  "ตรวจสารโทลูอีนในปัสสาวะ",
  "ตรวจสารไซลีนในปัสสาวะ",
  "ตรวจสารเมทิล เอทิล คีโตนในปัสสาวะ",
  "ตรวจสารฟีนอลในปัสสาวะ",
  "ตรวจสารเสพติดในปัสสาวะ",
];

const TOXIN_BLOOD_KEYS = ["ตรวจสารตะกั่วในเลือด", "ตรวจสารแคดเมียมในเลือด"];

const ITEM_LINKS: Record<string, string> = {
  "ตรวจสมรรถภาพการได้ยิน": "/user/health-check/health-risk/ear",
  "ตรวจสายตาทางอาชีวอนามัย": "/user/health-check/health-risk/eyes",
  "ตรวจการมองเห็นระยะไกล": "/user/health-check/health-risk/eyes-va",
};


const GROUPS = [
  { title: "Vitals", items: VITALS_KEYS },
  { title: "Vision & Hearing", items: VISION_HEARING_KEYS },
  { title: "Lab Chemistry", items: LAB_CHEMISTRY_KEYS },
  { title: "Hematology", items: HEMATOLOGY_KEYS },
  { title: "Urine & Toxicology", items: URINE_KEYS },
  { title: "Blood Toxicology", items: TOXIN_BLOOD_KEYS },
  { title: "Imaging & Functional", items: IMAGING_FUNCTIONAL_KEYS },
  { title: "Stool", items: STOOL_KEYS },
];

const TEST_COLUMNS: Array<{ key: string; label: string }> = [
  { key: "ตรวจคลื่นไฟฟ้าหัวใจ", label: "ECG" },
  { key: "ตรวจสมรรถภาพปอด", label: "Lung" },
  { key: "ตรวจเอ็กซเรย์ปอด", label: "Chest X-ray" },
  { key: "ตรวจปัสสาวะสมบูรณ์แบบ", label: "Urinalysis" },
];

const PIE_COLORS = ["#4C7A5A", "#B94A48", "#B07C2D", "#6B7280"];

const normalizeValue = (value: unknown) => String(value ?? "").trim();

const includeAny = (value: string, targets: string[]) =>
  targets.some((target) => value.includes(target));

const isNotTested = (value: string) =>
  includeAny(value, ["ไม่ได้รับการตรวจ", "ไม่รับการตรวจ", "ไม่ตรวจ"]);

const categorizeBmi = (value: string) => {
  if (value.includes("สมส่วน")) return "Normal";
  if (value.includes("น้ำหนักเกินเกณฑ์")) return "Overweight";
  if (value.includes("อ้วน")) return "Obese";
  if (value.includes("ผอม") || value.includes("น้ำหนักต่ำกว่าเกณฑ์")) return "Underweight";
  if (isNotTested(value)) return "Not tested";
  return "Other";
};

const categorizeBp = (value: string) => {
  if (value.includes("ต่ำ")) return "Low";
  if (value.includes("สูง")) return "High";
  if (value.includes("ปกติ")) return "Normal";
  if (isNotTested(value)) return "Not tested";
  return "Other";
};

const categorizeNormalAbnormal = (value: string) => {
  if (value.includes("ผิดปกติ")) return "abnormal";
  if (value.includes("ปกติ")) return "normal";
  if (isNotTested(value)) return "notTested";
  return "other";
};

const buildCountChart = (rows: HealthRow[], key: string, mapper: (value: string) => string) => {
  const counts = new Map<string, number>();
  rows.forEach((row) => {
    const value = normalizeValue(row[key]);
    const label = mapper(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const buildTestChart = (rows: HealthRow[]): TestDatum[] =>
  TEST_COLUMNS.map(({ key, label }) => {
    const tally = { normal: 0, abnormal: 0, notTested: 0, other: 0 };
    rows.forEach((row) => {
      const bucket = categorizeNormalAbnormal(normalizeValue(row[key]));
      tally[bucket] += 1;
    });
    return { name: label, ...tally };
  });

const toGroupId = (title: string) => `group-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

export default function RiskReport() {
  const [rows, setRows] = useState<HealthRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setError(null);
        const response = await fetch("/data/final_2568.json", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load data (${response.status} ${response.statusText})`);
        }
        const data = (await response.json()) as HealthRow[];
        if (active) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Failed to load data";
          setError(message);
          setRows([]);
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

  const totals = useMemo(() => {
    return {
      employees: rows.length,
    };
  }, [rows]);

  const bmiData = useMemo(() => buildCountChart(rows, BMI_KEY, categorizeBmi), [rows]);
  const bpData = useMemo(() => buildCountChart(rows, BP_KEY, categorizeBp), [rows]);
  const testData = useMemo(() => buildTestChart(rows), [rows]);
  const groupedItems = useMemo(() => {
    const known = new Set(GROUPS.flatMap((group) => group.items));
    DEMOGRAPHICS_KEYS.forEach((key) => known.add(key));
    const availableKeys = rows.length ? Object.keys(rows[0]) : [];
    const leftovers = availableKeys.filter((key) => !known.has(key));
    if (!leftovers.length) return GROUPS;
    return [...GROUPS, { title: "Other", items: leftovers }];
  }, [rows]);

  const [activeGroup, setActiveGroup] = useState<string>("Vitals");

  const visibleGroups =
    activeGroup === "All"
      ? groupedItems
      : groupedItems.filter((group) => group.title === activeGroup);



  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 pt-18 pb-8">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase">Employees</div>
            <div className="mt-2 text-3xl font-semibold">
              {loading ? "Loading…" : totals.employees.toLocaleString("en-US")}
            </div>

          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase ">BMI categories</div>
            {loading ? (
              <div className="mt-2 text-sm text-gray-500">Loading…</div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {bmiData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <div className="text-base font-semibold uppercase ">Blood pressure</div>
            {loading ? (
              <div className="mt-2 text-sm text-gray-500">Loading…</div>
            ) : (
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                {bpData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-base font-semibold uppercase">Grouped data items</div>
          <div className="mb-4 flex flex-wrap gap-2">
            {groupedItems.map((group) => (
              <button
                key={group.title}
                onClick={() => setActiveGroup(group.title)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold
                  ${activeGroup === group.title
                    ? "border-red-500 text-red-600 bg-red-50"
                    : "border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50"}
                    `}
              >
                {group.title}
              </button>

            ))}
            <button
              onClick={() => setActiveGroup("All")}
              className={`rounded-full border px-3 py-1 text-xs font-semibold
                ${activeGroup === "All"
                  ? "border-red-500 text-red-600 bg-red-50"
                  : "border-gray-200 text-gray-700 bg-white hover:border-gray-300 hover:bg-gray-50"}
                  `}
            >
              All
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {visibleGroups.map((group) => (
              <div
                key={group.title}
                id={toGroupId(group.title)}
                className="scroll-mt-24 rounded-2xl border border-gray-300 bg-white p-4 shadow-sm"
              >
                <div className="text-xs uppercase tracking-wide text-gray-500">{group.title}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((item) => {
                    const href = ITEM_LINKS[item];

                    return (
                      <span key={item}>
                        {href ? (
                          <Link
                            href={href}
                            className="inline-flex rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700 hover:border-gray-400 hover:bg-white"
                          >
                            {item}
                          </Link>
                        ) : (
                          <span className="inline-flex rounded-full border border-gray-300 bg-gray-50 px-3 py-1 text-xs text-gray-700">
                            {item}
                          </span>
                        )}
                      </span>
                    );
                  })}

                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-gray-700">BMI distribution</div>
            <div className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bmiData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4C7A5A" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="mb-4 text-sm font-semibold text-gray-700">Blood pressure outcomes</div>
            <div className="h-72">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Loading…
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={bpData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                      {bpData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5">
          <div className="mb-4 text-sm font-semibold text-gray-700">Risk findings by test</div>
          <div className="h-80">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                Loading…
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={testData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="normal" stackId="status" fill="#4C7A5A" />
                  <Bar dataKey="abnormal" stackId="status" fill="#B94A48" />
                  <Bar dataKey="notTested" stackId="status" fill="#B07C2D" />
                  <Bar dataKey="other" stackId="status" fill="#6B7280" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
