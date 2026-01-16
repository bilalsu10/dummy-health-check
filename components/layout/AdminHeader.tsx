'use client';
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminHeader() {
    const router = useRouter();

    return (
        <header className="relative z-50 border-b bg-white shadow-xl">
            <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">

                {/* Left */}
                <div className="flex items-center gap-4">
                    <Link href="/" className="cursor-pointer">
                        <Image
                            src="/logo/logo.svg"
                            alt="SCG"
                            width={200}
                            height={200}
                            className="h-12 w-auto"
                            priority
                        />
                    </Link>
                    <span className="uppercase text-sm font-semibold tracking-wide text-gray-900">
                        Health Check System
                    </span>
                </div>

                {/* Right */}
                <Button
                    variant="outline"
                    size="lg"
                    onClick={() => router.push("/")}
                    className="text-base font-semibold border-gray-300 text-gray-800 transition-all duration-200 shadow-md
                    hover:border-red-600 hover:text-red-700 hover:bg-red-50 hover:shadow-md"
                >
                    Logout
                </Button>

            </div>
        </header>
    );
} 
