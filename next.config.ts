import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
