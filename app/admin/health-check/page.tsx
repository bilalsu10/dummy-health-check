//app/dashboard/health-check/page.tsx
import Link from "next/link";



export default function HealthCheckHub() {
  return (
    <div className="min-h-screen bg-gray-50">


      <main className="mx-auto max-w-6xl px-6 pt-18 pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/health-check/health-risk"
            className="group rounded-2xl border bg-white p-5 hover:shadow-md hover:shadow-red-600/80"
          >
            <h3 className="text-base font-semibold">Health Risk</h3>
            <p className="mt-1 text-sm text-gray-600">
              Risk classification and overview
            </p>
            <p className="font-medium mt-4 text-sm text-gray-900 group-hover:text-red-600">Open →</p>
          </Link>

          <Link
            href="/admin/health-check/by-age-group"
            className="group rounded-2xl border bg-white p-5 hover:shadow-md hover:shadow-red-600/80"
          >
            <h3 className="text-base font-semibold">By Age Group</h3>
            <p className="mt-1 text-sm text-gray-600">
              Health data grouped by age
            </p>
            <p className="font-medium mt-4 text-sm text-gray-900 group-hover:text-red-600">Open →</p>
          </Link>

          <Link 
            href="/admin/health-check/trend"
            className="group rounded-2xl border bg-white p-5 hover:shadow-md hover:shadow-red-600/80"
          >
            <h3 className="text-base font-semibold">Trend</h3>
            <p className="mt-1 text-sm text-gray-600">
              Health trends over time
            </p>
            <p className="font-medium mt-4 text-sm text-gray-900 group-hover:text-red-600">Open →</p>
          </Link>
        </div>
      </main>
    </div>
  );
}

