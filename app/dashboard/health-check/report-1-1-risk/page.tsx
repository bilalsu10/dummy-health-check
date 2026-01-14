import Link from "next/link";

export default function RiskReport() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="text-xs text-gray-500">
            <Link href="/dashboard">Home</Link> /{" "}
            <Link href="/dashboard/health-check">Health Check</Link> / Risk
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Health Risk Report</h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        Report content goes here…
      </main>
    </div>
  );
}
