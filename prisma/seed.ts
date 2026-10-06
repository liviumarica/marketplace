/**
 * Seed script — creates realistic demo data for the hackathon judges:
 *  - an admin account (marketplace operator / platform fee recipient)
 *  - two sellers with PayPal sandbox identities configured
 *  - one buyer
 *  - several ACTIVE listings for AI-built SaaS apps
 *
 * Demo logins: admin@agentbay.dev, alex@seller.dev, maria@seller.dev, bob@buyer.dev
 *
 * Passwords:
 *   - local SQLite: "password123" for every account (convenient for dev),
 *   - hosted PostgreSQL (production): taken from SEED_ADMIN_PASSWORD (admin)
 *     and SEED_DEMO_PASSWORD (alex / maria / bob). Both are REQUIRED there,
 *     must be at least 12 characters and must not be "password123" — the
 *     script aborts otherwise, so public README credentials can never end
 *     up guarding a live deployment.
 * Re-running the seed resets the demo passwords to the given values and
 * signs out existing sessions of those accounts.
 *
 * Demo listings / custom request are fabricated sample content (fake demo
 * URLs and verification scores). They are created locally, but on
 * PostgreSQL only when SEED_DEMO_CONTENT=true is set explicitly.
 *
 * Run with: npm run db:seed
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/** Same detection rule as prisma.config.ts. */
const isPostgres = /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL || "");

/**
 * Resolve the password for a group of demo accounts. Local dev falls back to
 * "password123"; PostgreSQL requires a strong value from the environment.
 */
function demoPassword(envName: "SEED_ADMIN_PASSWORD" | "SEED_DEMO_PASSWORD"): string {
  const value = process.env[envName];
  if (!isPostgres) return value || "password123";
  if (!value || value.length < 12 || value === "password123") {
    throw new Error(
      `${envName} must be set to a strong password (min 12 characters, not "password123") when seeding PostgreSQL.`,
    );
  }
  return value;
}

async function main() {
  // Admin gets its own password: it can see every transaction and fee.
  const adminPasswordHash = await bcrypt.hash(demoPassword("SEED_ADMIN_PASSWORD"), 10);
  const passwordHash = await bcrypt.hash(demoPassword("SEED_DEMO_PASSWORD"), 10);
  // Applied on every run so existing accounts get the new password and all
  // their previously issued sessions are invalidated.
  const passwordReset = (hash: string) => ({ passwordHash: hash, sessionVersion: { increment: 1 } });

  // ---------------------------------------------------------------- users
  // Real sandbox accounts (PayPal developer dashboard > Sandbox > Accounts):
  //   platform/partner : sb-m9fs053148149@business.example.com  (owns the app)
  //   seller           : sb-ws8bg53096423@business.example.com  (receives payouts)
  //   buyer            : sb-roi4n53159859@personal.example.com  (pays at checkout)
  // `update` syncs the PayPal fields so re-seeding picks up new credentials.
  const admin = await prisma.user.upsert({
    where: { email: "admin@agentbay.dev" },
    update: {
      ...passwordReset(adminPasswordHash),
      paypalEmail: "sb-m9fs053148149@business.example.com",
      paypalMerchantId: process.env.PAYPAL_PLATFORM_MERCHANT_ID || null,
    },
    create: {
      email: "admin@agentbay.dev",
      name: "AgentBay Admin",
      role: "ADMIN",
      passwordHash: adminPasswordHash,
      paypalEmail: "sb-m9fs053148149@business.example.com",
      paypalMerchantId: process.env.PAYPAL_PLATFORM_MERCHANT_ID || null,
    },
  });

  const alex = await prisma.user.upsert({
    where: { email: "alex@seller.dev" },
    update: {
      ...passwordReset(passwordHash),
      paypalEmail: "sb-ws8bg53096423@business.example.com",
      paypalMerchantId: process.env.PAYPAL_SELLER_MERCHANT_ID || null,
    },
    create: {
      email: "alex@seller.dev",
      name: "Alex Popescu",
      role: "SELLER",
      passwordHash,
      bio: "Indie builder shipping AI-assisted SaaS tools.",
      // Real sandbox business account — payouts land in its dashboard.
      paypalEmail: "sb-ws8bg53096423@business.example.com",
      paypalMerchantId: process.env.PAYPAL_SELLER_MERCHANT_ID || null,
    },
  });

  const maria = await prisma.user.upsert({
    where: { email: "maria@seller.dev" },
    update: {
      ...passwordReset(passwordHash),
      paypalEmail: "sb-ws8bg53096423@business.example.com",
      paypalMerchantId: null,
    },
    create: {
      email: "maria@seller.dev",
      name: "Maria Ionescu",
      role: "SELLER",
      passwordHash,
      bio: "Full-stack dev, builds niche B2B micro-SaaS with AI.",
      // Same sandbox business account — the demo only has one seller account.
      paypalEmail: "sb-ws8bg53096423@business.example.com",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@buyer.dev" },
    update: {
      ...passwordReset(passwordHash),
      paypalEmail: "sb-roi4n53159859@personal.example.com",
    },
    create: {
      email: "bob@buyer.dev",
      name: "Bob Dumitru",
      role: "BUYER",
      passwordHash,
      // Real sandbox personal account — used to approve payments.
      paypalEmail: "sb-roi4n53159859@personal.example.com",
    },
  });

  // Demo accounts use non-deliverable .dev addresses, so they can never click
  // a verification link — mark them verified so they can transact.
  await prisma.user.updateMany({
    where: {
      id: { in: [admin.id, alex.id, maria.id, bob.id] },
      emailVerifiedAt: null,
    },
    data: { emailVerifiedAt: new Date() },
  });

  // Fabricated sample content stays out of PostgreSQL unless asked for.
  const withDemoContent = !isPostgres || process.env.SEED_DEMO_CONTENT === "true";
  if (!withDemoContent) {
    console.log("Seed complete (accounts only — set SEED_DEMO_CONTENT=true for sample listings):", {
      users: [admin.email, alex.email, maria.email, bob.email],
    });
    return;
  }

  // ------------------------------------------------------------- listings
  const listings = [
    {
      sellerId: alex.id,
      title: "InvoicePilot",
      slug: "invoicepilot-demo",
      tagline: "AI invoicing assistant that chases your unpaid invoices for you",
      description:
        "InvoicePilot generates, sends and tracks invoices for freelancers and small agencies. " +
        "The built-in AI writes polite but firm payment reminders, predicts which clients will pay late, " +
        "and drafts the follow-up emails automatically.\n\n" +
        "Sold as a complete business: full Next.js + Postgres source code, brand, landing page copy, " +
        "and onboarding docs. Zero revenue yet — priced for a quick acquisition.",
      category: "Finance",
      techStack: ["Next.js", "TypeScript", "Postgres", "OpenAI", "Tailwind"],
      features: [
        "AI-drafted payment reminder emails",
        "Late-payment risk prediction per client",
        "PDF invoice generation",
        "Client portal with payment status",
        "Recurring invoice schedules",
        "Revenue dashboard",
      ],
      priceCents: 240000, // $2,400
      demoUrl: "https://invoicepilot-demo.example.com",
      repoUrl: "https://github.com/example/invoicepilot",
      status: "ACTIVE",
      verificationStatus: "PASSED",
      aiQualityScore: 88,
    },
    {
      sellerId: alex.id,
      title: "SupportGenie",
      slug: "supportgenie-demo",
      tagline: "AI support agent that answers tickets from your docs",
      description:
        "SupportGenie ingests your help docs and answers customer tickets automatically. " +
        "It escalates to a human only when confidence is low, and learns from every resolved ticket.\n\n" +
        "Includes the full codebase (ingestion pipeline, embeddings search, agent loop, admin UI), " +
        "documentation, and the marketing site.",
      category: "Customer Support",
      techStack: ["React", "Node.js", "Elasticsearch", "OpenAI"],
      features: [
        "Doc ingestion with semantic search",
        "Automatic ticket answers with confidence scores",
        "Human escalation workflow",
        "Multi-language support",
        "Slack + email integrations",
      ],
      priceCents: 390000, // $3,900
      demoUrl: "https://supportgenie-demo.example.com",
      repoUrl: "https://github.com/example/supportgenie",
      status: "ACTIVE",
      verificationStatus: "PASSED",
      aiQualityScore: 82,
    },
    {
      sellerId: maria.id,
      title: "ContentCompass",
      slug: "contentcompass-demo",
      tagline: "AI content calendar that writes and schedules your posts",
      description:
        "ContentCompass plans a month of social content in minutes: it analyzes your niche, " +
        "generates posts in your brand voice, and queues them for publishing.\n\n" +
        "Complete business sale — codebase, brand assets, prompt library, and a short ops playbook.",
      category: "Marketing",
      techStack: ["Next.js", "Prisma", "OpenAI", "Vercel"],
      features: [
        "Brand-voice trained post generator",
        "30-day content calendar",
        "One-click queueing to social platforms",
        "Performance analytics",
      ],
      priceCents: 145000, // $1,450
      demoUrl: "https://contentcompass-demo.example.com",
      repoUrl: "https://github.com/example/contentcompass",
      status: "ACTIVE",
      verificationStatus: "RUNNING",
      aiQualityScore: null,
    },
    {
      sellerId: maria.id,
      title: "DevMetrics",
      slug: "devmetrics-demo",
      tagline: "Analytics dashboard for engineering teams, powered by AI summaries",
      description:
        "DevMetrics connects to your Git repos and CI and turns raw activity into weekly " +
        "AI-written engineering reports — velocity, review latency, risk hotspots.\n\n" +
        "Sale includes full source, infra-as-code for deployment, and docs.",
      category: "Analytics",
      techStack: ["Next.js", "ClickHouse", "OpenAI", "Docker"],
      features: [
        "Git + CI ingestion",
        "AI-written weekly team reports",
        "Velocity and review-latency tracking",
        "Anomaly alerts",
      ],
      priceCents: 520000, // $5,200
      status: "ACTIVE",
      verificationStatus: "NONE",
      aiQualityScore: null,
    },
  ];

  for (const data of listings) {
    await prisma.listing.upsert({
      where: { slug: data.slug },
      update: {},
      create: {
        ...data,
        techStack: JSON.stringify(data.techStack),
        features: JSON.stringify(data.features),
        screenshots: "[]",
      },
    });
  }

  // ------------------------------------------------------- a custom request
  await prisma.customRequest.upsert({
    where: { id: "seed-request-1" },
    update: {},
    create: {
      id: "seed-request-1",
      buyerId: bob.id,
      title: "Booking app for my barbershop",
      brief:
        "I need a simple booking app: customers pick a service and a time slot, " +
        "get email confirmation, and I can block out days off. Should take " +
        "payments for no-show protection.",
      budgetCents: 80000, // $800
      deadlineDays: 14,
      category: "Productivity",
    },
  });

  console.log("Seed complete:", {
    users: [admin.email, alex.email, maria.email, bob.email],
    // Never print real passwords — only say where they came from.
    passwords: isPostgres ? "from SEED_ADMIN_PASSWORD / SEED_DEMO_PASSWORD" : "password123",
    listings: listings.length,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
