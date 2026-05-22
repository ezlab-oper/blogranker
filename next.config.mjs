/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 내부 관리자 도구 — 빌드 시 lint 오류로 배포가 막히지 않도록 분리 (lint는 별도 npm run lint)
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
