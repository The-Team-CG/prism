import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@prism/ui", "@prism/tokens", "@prism/api-client", "@prism/types"],
};

export default nextConfig;
