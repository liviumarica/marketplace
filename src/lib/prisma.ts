/**
 * Prisma client singleton.
 *
 * Next.js dev mode reloads modules on every request; without this guard each
 * reload would create a new PrismaClient and exhaust the database connection
 * pool. We cache the client on `globalThis` so exactly one instance survives
 * hot reloads.
 */
import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";

// Turbopack relocates the generated client's directory. Point Prisma 6 at
// the library included by outputFileTracingIncludes in each Vercel function.
if (process.env.VERCEL && process.platform === "linux" && !process.env.PRISMA_QUERY_ENGINE_LIBRARY) {
  process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(
    process.cwd(), "src/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node",
  );
}

/**
 * Resolve DATABASE_URL for the client.
 *
 * `prisma migrate` interprets a relative `file:` URL against the schema
 * directory (prisma/), but the generated ESM client resolves it against the
 * bundled module location — which is wrong under Turbopack. Normalising to
 * an absolute file:// URL here keeps `DATABASE_URL="file:./dev.db"` portable
 * while leaving real connection strings (postgres/mysql) untouched.
 */
function resolveDatasourceUrl(): string | undefined {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return undefined; // postgres/mysql → pass through
  const filePath = url.slice("file:".length);
  // Already absolute (POSIX `/...` or Windows `C:\...`) → keep as-is.
  if (/^([a-zA-Z]:[\\/]|\/)/.test(filePath)) return url;
  // Prisma's sqlite connector expects `file:` + a filesystem path with
  // forward slashes — NOT an RFC file:// URL (that form is rejected).
  const absolute = path.resolve(process.cwd(), "prisma", filePath);
  return `file:${absolute.replaceAll("\\", "/")}`;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolveDatasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
