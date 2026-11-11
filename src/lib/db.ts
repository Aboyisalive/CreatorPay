import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
}

/**
 * Neon (serverless driver over WebSockets, keeps interactive transactions)
 * when the URL points at Neon or DATABASE_DRIVER=neon; plain node-postgres
 * otherwise, e.g. a local Postgres in development.
 */
function isNeonConnection(url: string) {
  const driver = process.env.DATABASE_DRIVER;
  if (driver) return driver === "neon";
  return /\.neon\.tech\b/.test(url);
}

function createPrismaClient() {
  const adapter = isNeonConnection(connectionString!)
    ? new PrismaNeon({ connectionString })
    : new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
