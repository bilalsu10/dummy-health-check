'use client';
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="
        absolute
        top-9
        left-2
        z-50
        font-semibold text-gray-600
        transition-colors
        hover:text-red-600
      "
    >
      ← กลับ
    </button>
  );
}
