//app/admin/page.tsx

import Link from "next/link";

const tiles = [
  { href: "/user/health-check", title: "Health Check", desc: "Reports, risks, trends" },
  { href: "/dashboard/treatment", title: "Treatment History", desc: "Hospital / clinic overview" },
  { href: "/dashboard/fit-mission", title: "Fit Mission", desc: "Before/after and points" },
  { href: "/dashboard/mental-health", title: "Mental Health", desc: "Mental health overview" },
  { href: "/dashboard/benefits", title: "Benefits", desc: "Benefits and welfare" },
  { href: "/dashboard/doctor-schedule", title: "Doctor Schedule", desc: "Schedules and availability" },
  { href: "/dashboard/download-certificate", title: "Download Certificate", desc: "Certificates and documents" },
  { href: "/dashboard/facility-feedback", title: "Facility Feedback", desc: "Feedback and forms" },
  { href: "/dashboard/thai-massage-booking", title: "Thai Massage Booking", desc: "Booking & calendar" },
];



export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="text-base font-semibold">{t.title}</div>
              <div className="mt-1 text-sm text-gray-600">{t.desc}</div>
              <div className="mt-4 text-sm text-gray-900">Open →</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
