import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const buildId = process.env.LEAF_BUILD_ID;

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
];

const framingPolicy = {
  key: "Content-Security-Policy",
  value: "frame-ancestors 'none'",
};

const routesWithoutOwnContentPolicy = "/((?!api/uploads|api/avatar).*)";

const nextConfig: NextConfig = {
  distDir: process.env.LEAF_DIST_DIR ?? ".next",
  deploymentId: buildId,
  env: {
    NEXT_PUBLIC_LEAF_BUILD_ID: buildId ?? "development",
  },
  poweredByHeader: false,
  serverExternalPackages: ["@blocknote/server-util", "jsdom", "yjs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: routesWithoutOwnContentPolicy, headers: [framingPolicy] },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
