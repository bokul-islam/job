import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg uses native Node.js modules — keep it out of webpack bundling
  serverExternalPackages: ["pg"],

  // safe error pages — never expose stack traces
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
