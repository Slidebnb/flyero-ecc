import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY ?? "",
    NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED: process.env.NEXT_PUBLIC_GOOGLE_MAPS_BOUNDARIES_ENABLED ?? "false",
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
