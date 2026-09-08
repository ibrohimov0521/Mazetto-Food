import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.join(configDir, "../.."),
  transpilePackages: ["@mazetto/ui"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "https://api.mazettofood.uz/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
