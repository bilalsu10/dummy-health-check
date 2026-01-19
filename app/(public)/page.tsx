// app/(public)/page.tsx
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export default function PublicHomePage() {
  return (
    <section className="relative min-h-[calc(100vh-5rem)] bg-white overflow-hidden">
      
      {/* Subtle red accent background */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-red-50/90 via-white to-red-50/20" />

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1fr_420px]">
        
        {/* LEFT : Text content */}
        <div className="max-w-2xl">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-gray-900 sm:text-5xl">
            ระบบแสดงผลการตรวจสุขภาพพนักงาน
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-gray-600">
            ระบบภายในสำหรับพนักงาน SCG ใช้ในการตรวจสอบ
            และติดตามผลการตรวจสุขภาพของตนเอง
            อย่างเป็นระบบ ปลอดภัย และเชื่อถือได้
          </p>

          <ul className="mt-6 space-y-2 text-sm text-gray-600">
            <li>• แสดงผลข้อมูลสุขภาพตามหมวดการตรวจ</li>
            <li>• เข้าถึงข้อมูลตามสิทธิ์ผู้ใช้งาน</li>
            <li>• ออกแบบเพื่อการใช้งานภายในองค์กร</li>
          </ul>

          <div className="mt-10">
            <Button
              asChild
              size="lg"
              className="bg-red-600 px-10 text-base font-semibold text-white shadow-xl
                         hover:bg-red-700 hover:shadow-md transition-all"
            >
              <Link href="/login">เข้าสู่ระบบ</Link>
            </Button>
          </div>
        </div>

        {/* RIGHT : Image */}
        <div className="relative hidden h-full items-center justify-center lg:flex">
          <Image
            src="/images/body.png"
            // src="/images/heart.png"
            alt="Health Illustration"
            width={1024}
            height={1536}
            className="max-h-[600px] w-auto select-none "
            priority
          />
        </div>
      </div>
    </section>
  );
}
