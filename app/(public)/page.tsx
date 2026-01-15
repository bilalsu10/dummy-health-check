'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">Welcome to Health Check</h1>
        <p className="text-lg text-gray-600 mb-8">
          สำรวจสุขภาพของคุณและจัดการข้อมูลทางการแพทย์ของคุณ
        </p>
        
        <Link 
          href="/user/"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition duration-300 ease-in-out transform hover:scale-105"
        >
          ไปที่หน้า Home
        </Link>
      </div>
    </div>
  );
}
