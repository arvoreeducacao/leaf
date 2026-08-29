import createNextIntlPlugin from "next-intl/plugin";
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

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
