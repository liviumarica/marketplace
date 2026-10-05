import "dotenv/config";

const errors = [];

if (!/^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "")) {
  errors.push("Set DATABASE_URL to a hosted PostgreSQL connection string in Vercel.");
}
const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED;
if (directUrl && !/^postgres(ql)?:\/\//.test(directUrl)) {
  errors.push("DIRECT_URL or DATABASE_URL_UNPOOLED must be a PostgreSQL connection string for migrations.");
}
const secret = process.env.AUTH_SECRET || "";
if (secret.length < 32 || /^(generate-a-long|dev-only)/.test(secret)) {
  errors.push("Set AUTH_SECRET to a random secret of at least 32 characters in Vercel.");
}

// Email verification and password reset depend on real email delivery.
if (!process.env.RESEND_API_KEY) {
  errors.push("Set RESEND_API_KEY in Vercel — verification and password-reset emails cannot be sent without it.");
}
if (!process.env.EMAIL_FROM) {
  console.log("EMAIL_FROM is not set: emails will be sent from the default AgentBay <market@adskings.com>.");
}

if (errors.length) {
  console.error("Vercel deployment configuration is incomplete:\n" + errors.join("\n"));
  process.exit(1);
}

console.log("Vercel database, authentication and email configuration validated.");
