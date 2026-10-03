import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma's generated native library must be copied into Vercel functions.
  outputFileTracingIncludes: {
    "/*": ["./src/generated/prisma/*.node"],
  },
};

export default nextConfig;
