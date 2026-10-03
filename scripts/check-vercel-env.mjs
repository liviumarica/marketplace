import "dotenv/config";

const errors = [];

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  errors.push("Set DATABASE_URL to a hosted PostgreSQL connection string in Vercel.");
}
if (process.env.DIRECT_URL && !/^postgres(ql)?:\/\//.test(process.env.DIRECT_URL)) {
  errors.push("DIRECT_URL must be a PostgreSQL connection string for migrations.");
}
const secret = process.env.AUTH_SECRET || "";
if (secret.length < 32 || /^(generate-a-long|dev-only)/.test(secret)) {
  errors.push("Set AUTH_SECRET to a random secret of at least 32 characters in Vercel.");
}

if (errors.length) {
  console.error("Vercel deployment configuration is incomplete:\n" + errors.join("\n"));
  process.exit(1);
}

console.log("Vercel database and authentication configuration validated.");
