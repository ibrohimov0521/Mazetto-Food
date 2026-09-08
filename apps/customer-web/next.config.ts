import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = (process.env.API_INTERNAL_URL || (process.env.NODE_ENV === "production"
  ? "http://mazetto-food-backend-pdslpm:4000" : "http://127.0.0.1:4000")).replace(/\/$/, "");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.mazettofood.uz",
      },
    ],
  },
  output: "standalone",
  outputFileTracingRoot: path.join(configDir, "../.."),
  transpilePackages: ["@mazetto/api-client", "@mazetto/ui"],
  async headers() {
    return [
      {
        source: "/design-options.html",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
