import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.PRISM_DOCKER_STANDALONE === "1" ? { output: "standalone" as const } : {}),
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@prism/ui", "@prism/tokens", "@prism/api-client", "@prism/types"],
};

export default nextConfig;
