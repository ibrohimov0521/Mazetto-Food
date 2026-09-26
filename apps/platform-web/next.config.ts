import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const configDir = path.dirname(fileURLToPath(import.meta.url));
const apiOrigin = (process.env.BESTTEAM_API_INTERNAL_URL || "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  allowedDevOrigins: ["127.0.0.1"],
  output: "standalone",
  outputFileTracingRoot: path.join(configDir, "../.."),
  async rewrites() {
    return apiOrigin
      ? [{ source: "/api/v1/:path*", destination: `${apiOrigin}/api/v1/:path*` }]
      : [];
  },
};

export default nextConfig;
