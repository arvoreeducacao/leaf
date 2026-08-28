import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@blocknote/server-util", "jsdom"],
};

export default nextConfig;
