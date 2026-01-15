//app/(public)/page.tsx
'use client';

import Link from 'next/link';
import { Button } from "@/components/ui/button";


export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Health Check</h1>
        <p className="text-lg text-gray-600 mb-8">
          สำรวจสุขภาพของคุณและจัดการข้อมูลทางการแพทย์ของคุณ
        </p>

        <Button asChild size="lg">
          <Link href="/user">ไปที่หน้า Home</Link>
        </Button>

      </div>
    </div>
  );
}
