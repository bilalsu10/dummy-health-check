export default function Trend() {
  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-6xl px-6 pt-18 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center text-center py-12">
            <div className="mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
                <span className="text-2xl">🚧</span>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Under Development
            </h1>
            <p className="text-gray-600 text-lg max-w-md">
              หน้านี้กำลังอยู่ในระหว่างการพัฒนา!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
