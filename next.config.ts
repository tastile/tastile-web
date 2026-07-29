import bundleAnalyzer from "@next/bundle-analyzer";
import type { NextConfig } from "next";

const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });

const nextConfig: NextConfig = {
  output: "standalone",
  // A dedicated dist directory lets an integration server run beside a
  // developer's normal `next dev` process without sharing its lock or cache.
  distDir: process.env.TASTILE_NEXT_DIST_DIR ?? ".next",
  reactCompiler: true,
  allowedDevOrigins: ['localhost', '127.0.0.1'],
  async redirects() {
    return [
      {
        source: '/app/now',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/app',
        destination: '/dashboard',
        permanent: true,
      },
      {
        source: '/app/:path*',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
};

export default withBundleAnalyzer(nextConfig);
