import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated native library must be copied into Vercel functions.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/*.node"],
    // Playwright loads this registry dynamically when the KERNEL agent starts.
    "/api/*": ["./node_modules/playwright-core/browsers.json"],
  },
};

export default nextConfig;
