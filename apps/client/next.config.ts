import path from "node:path";
import type { NextConfig } from "next";

const serviceMode = process.env.PRISM_VERCEL_SERVICES === "1";
const basePath = "";

const nextConfig: NextConfig = {
  basePath,
  ...(serviceMode ? { env: { NEXT_PUBLIC_API_URL: "", NEXT_PUBLIC_PRISM_API_BASE_URL: "/api", NEXT_PUBLIC_PORTAL_BASE_PATH: basePath } } : {}),
  ...(process.env.PRISM_DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@prism/ui", "@prism/tokens", "@prism/api-client", "@prism/types"],
};

export default nextConfig;
