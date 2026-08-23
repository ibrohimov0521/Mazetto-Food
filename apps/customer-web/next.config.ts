import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@mazetto/api-client", "@mazetto/ui"],
};

export default nextConfig;
