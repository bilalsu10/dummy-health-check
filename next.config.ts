import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://172.16.4.185:3000",
    "http://172.16.4.185",
    "172.16.4.185:3000",
    "172.16.4.185",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
};

export default nextConfig;
