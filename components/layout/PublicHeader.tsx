// components/layout/PublicHeader.tsx
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function PublicHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        {/* Left: Logo + System name */}
        <div className="flex items-center gap-3">
          <Image
            src="/logo/logo.svg"
            alt="SCG"
            width={36}
            height={36}
            priority
          />
          <span className="text-sm font-semibold tracking-wide text-gray-900">
            Employee Health Check System
          </span>
        </div>

        {/* Right: Login */}
        <Button
          asChild
          variant="outline"
          className="border-gray-300 text-gray-900 hover:border-red-600 hover:text-red-600"
        >
          <Link href="/login">Login</Link>
        </Button>
      </div>
    </header>
  );
}
