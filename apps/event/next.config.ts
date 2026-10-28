import path from "node:path";
import type { NextConfig } from "next";

const serviceMode = process.env.PRISM_VERCEL_SERVICES === "1";
const basePath = serviceMode ? "/event" : "";

const nextConfig: NextConfig = {
  ...(process.env.PRISM_NEXT_DIST_DIR ? { distDir: process.env.PRISM_NEXT_DIST_DIR } : {}),
  basePath,
  ...(serviceMode ? { env: {
    NEXT_PUBLIC_API_URL: "",
    NEXT_PUBLIC_PRISM_API_BASE_URL: "/api",
    NEXT_PUBLIC_PORTAL_BASE_PATH: basePath,
    NEXT_PUBLIC_CLIENT_PORTAL_URL: "/",
    NEXT_PUBLIC_SUPPLIER_PORTAL_URL: "/supplier",
    NEXT_PUBLIC_GUEST_PORTAL_URL: "/guest",
    NEXT_PUBLIC_EVENT_PORTAL_URL: "/event",
  } } : {}),
  ...(process.env.PRISM_DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@prism/ui", "@prism/tokens", "@prism/api-client", "@prism/types"],
};

export default nextConfig;
