//app/dashboard/health-check/page.tsx
import Link from "next/link";



export default function HealthCheckHub() {
  return (
    <div className="min-h-screen bg-gray-50">


      <main className="mx-auto max-w-6xl px-6 py-8"><main className="mx-auto max-w-6xl px-6 py-8">
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Link
      href="/user/health-check/health-risk"
      className="rounded-2xl border bg-white p-5 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold">Health Risk</h3>
      <p className="mt-1 text-sm text-gray-600">
        Risk classification and overview
      </p>
    </Link>

    <Link
      href="/dashboard/health-check/report-1-2-by-age"
      className="rounded-2xl border bg-white p-5 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold">By Age Group</h3>
      <p className="mt-1 text-sm text-gray-600">
        Health data grouped by age
      </p>
    </Link>

    <Link
      href="/dashboard/health-check/report-1-4-trend"
      className="rounded-2xl border bg-white p-5 hover:shadow-md"
    >
      <h3 className="text-lg font-semibold">Trend</h3>
      <p className="mt-1 text-sm text-gray-600">
        Health trends over time
      </p>
    </Link>
  </div>
</main>
</main>
    </div>
  );
}
