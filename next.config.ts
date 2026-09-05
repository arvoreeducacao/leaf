import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const buildId = process.env.LEAF_BUILD_ID;

const nextConfig: NextConfig = {
  distDir: process.env.LEAF_DIST_DIR ?? ".next",
  deploymentId: buildId,
  env: {
    NEXT_PUBLIC_LEAF_BUILD_ID: buildId ?? "development",
  },
  serverExternalPackages: ["@blocknote/server-util", "jsdom", "yjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
