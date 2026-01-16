export default function Footer() {
  return (
    <footer className="relative z-10 border-t bg-white shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <div className="flex flex-col items-center justify-between gap-2 text-xs text-gray-500 sm:flex-row">
          
          {/* Left */}
          <span>
            © {new Date().getFullYear()} Siam Cement Group (SCG)
          </span>

          {/* Right */}
          <span className="tracking-wide">
            Health Check System
          </span>

        </div>
      </div>
    </footer>
  );
}