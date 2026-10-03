
import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";
const isPostgres = /^postgres(ql)?:\/\//.test(databaseUrl);

if (!isPostgres && !databaseUrl.startsWith("file:")) {
  throw new Error("DATABASE_URL must be a SQLite file: URL or a PostgreSQL URL.");
}
if (process.env.VERCEL && !isPostgres) {
  throw new Error("Vercel requires a hosted PostgreSQL DATABASE_URL; local SQLite is not persistent.");
}

// Keep one model definition while using separate migration histories for
// local SQLite and hosted PostgreSQL. Prisma's provider cannot use env().
const schema = isPostgres
  ? "prisma/schema.postgresql.prisma"
  : "prisma/schema.prisma";

if (isPostgres) {
  const source = readFileSync("prisma/schema.prisma", "utf8");
  writeFileSync(schema, source.replace('provider = "sqlite"', 'provider = "postgresql"'));
}

export default defineConfig({
  schema,
  migrations: {
    path: isPostgres ? "prisma/migrations-postgresql" : "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  engine: "classic",
  datasource: {
    url: databaseUrl,
    ...(isPostgres && process.env.DIRECT_URL
      ? { directUrl: process.env.DIRECT_URL }
      : {}),
  },
});
