import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker/Kubernetes (Forge cluster) builds set BUILD_STANDALONE=1. Vercel ignores it.
  ...(process.env.BUILD_STANDALONE ? { output: "standalone" as const } : {}),
  /* config options here */
  serverExternalPackages: [
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
    "@node-rs/argon2",
  ],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
