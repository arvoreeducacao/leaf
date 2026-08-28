import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.LEAF_DIST_DIR ?? ".next",
  serverExternalPackages: ["@blocknote/server-util", "jsdom"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
