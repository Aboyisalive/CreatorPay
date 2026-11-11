import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (unpooled) connection on Neon; the app uses
    // the pooled DATABASE_URL at runtime.
    url: process.env.DIRECT_URL ? env("DIRECT_URL") : env("DATABASE_URL"),
  },
});
