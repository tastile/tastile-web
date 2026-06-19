import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactCompiler: false,
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

export default nextConfig;
