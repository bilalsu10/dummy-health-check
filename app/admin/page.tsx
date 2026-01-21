//app/user/page.tsx

import Link from "next/link";


const tiles = [
  { href: "/admin/health-check", title: "Health Check", desc: "Reports, risks, trends" },
  { href: "/admin/treatment", title: "Treatment History", desc: "Hospital / clinic overview" },
  { href: "/admin/fit-mission", title: "Fit Mission", desc: "Before/after and points" },
  { href: "/admin/mental-health", title: "Mental Health", desc: "Mental health overview" },
  { href: "/admin/benefits", title: "Benefits", desc: "Benefits and welfare" },
  { href: "/admin/doctor-schedule", title: "Doctor Schedule", desc: "Schedules and availability" },
  { href: "/admin/download-certificate", title: "Download Certificate", desc: "Certificates and documents" },
  { href: "/admin/facility-feedback", title: "Facility Feedback", desc: "Feedback and forms" },
  { href: "/admin/thai-massage-booking", title: "Thai Massage Booking", desc: "Booking & calendar" },
];

 

export default function Home() {
  return (       
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl pt-18 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md hover:shadow-red-600/80"
            >
              <div className="text-base font-semibold">{t.title}</div>
              <div className="mt-1 text-sm text-gray-600">{t.desc}</div>
              <div className="font-medium mt-4 text-sm text-gray-900 group-hover:text-red-600">Open →</div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
