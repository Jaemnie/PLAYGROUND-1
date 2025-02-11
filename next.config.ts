import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // ESLint 검사를 비활성화합니다
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
