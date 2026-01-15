"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (username === "user") {
      router.push("/user");
    } else if (username === "admin") {
      router.push("/admin");
    } else {
      setError("ชื่อผู้ใช้ไม่ถูกต้อง (ใช้ user หรือ admin)");
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-sm">
        
        <h1 className="mb-1 text-xl font-semibold text-gray-900">
          เข้าสู่ระบบ
        </h1>
        <p className="mb-6 text-sm text-gray-600">
          Health Check System
        </p>

        <div className="space-y-4">
          <div>
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="user หรือ admin"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* password mock (optional) */}
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="mock password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            onClick={handleLogin}
            size="lg"
            className="w-full bg-red-600 text-white hover:bg-red-700"
          >
            Login
          </Button>
        </div>

        {/* <div className="mt-6 text-xs text-gray-500">
          * Demo mode: ใช้ <strong>user</strong> หรือ <strong>admin</strong>
        </div> */}
      </div>
    </div>
  );
}
