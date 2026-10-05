# AgentBay — the marketplace for AI-built SaaS businesses

**Buy a complete AI-built SaaS business — code, brand, docs, everything — or order a custom app that a developer builds with AI.** PayPal handles the money (split payments, escrow), AI handles the busywork (listing autopilot, price suggestions, verification, a conversational shopping agent that can actually check out).

Built for the [PayPal AI Hackathon](https://paypalaihackathon.devpost.com/).

---

## What it does

### Track 1 — Sell your whole business
A seller lists a complete SaaS app: source repo, brand, copy, docs. The **AI listing autopilot** fills the listing form from a single URL, the **AI price advisor** suggests a price benchmarked against real product data, and the **KERNEL verification agent** opens the app's demo URL in a real cloud browser, exercises it, and awards an "AI Verified" badge with a quality score.

A buyer clicks *Buy with PayPal* → approves in the PayPal popup → the payment **splits automatically** between the seller and the platform. The repo/transfer assets unlock on the order page after payment.

### Track 2 — Order a custom app (Fiverr-style, with escrow)
A buyer posts a request ("booking app for my barbershop, $800, 2 weeks"). The **AI brief refiner** turns the rough idea into a structured spec. Developers send offers. The buyer picks one and funds it — PayPal `intent=AUTHORIZE` holds the money **without capturing** (escrow). The developer delivers → the buyer accepts → the authorization is **captured** and the developer's share is paid out. If something goes wrong the buyer disputes → the authorization is **voided** and money returns untouched.

### The AI shopping agent
`/chat` is a conversational buyer agent. Tell it *"find me an invoicing SaaS under $500"* — it searches the marketplace (hybrid semantic + keyword via Elasticsearch), recommends real listings, and can **create a real PayPal order** through the official **PayPal Agent Toolkit** — agentic commerce, literally.

---

## PayPal integration (the meaningful part)

| Feature | How it's used |
|---|---|
| **Orders v2 — split payments** | One PayPal order, value split seller/platform. Two modes: `multi_unit` (two purchase units with different `payee`s — production-grade shape) and `payout` (platform captures, then pays the seller share via **Payouts API** — works in every sandbox). |
| **Escrow for custom work** | `intent=AUTHORIZE` → `payments/authorizations/{id}/capture` on acceptance → `…/void` on dispute. Real hold/capture/release against the sandbox API. |
| **PayPal Agent Toolkit** (`@paypal/agent-toolkit`) | The buyer agent calls `create_order`/`get_order`/`create_invoice` as LLM tools — real PayPal API calls inside a chat. |
| **JS SDK buttons** (`@paypal/react-paypal-js`) | Buyer-side approval for both purchase and escrow-funding flows. |
| **Webhooks** | `/api/paypal/webhook` verifies `verify-webhook-signature` and reconciles `PAYMENT.CAPTURE.*` / `PAYMENT.AUTHORIZATION.*` events idempotently. |

### Sandbox setup
1. [developer.paypal.com](https://developer.paypal.com) → create a **sandbox REST app** → copy Client ID + Secret.
2. Create **two sandbox business accounts**: one for a *seller*, one for the *platform* (receives the commission). Copy the platform account's **Merchant ID**.
3. Create a personal sandbox account = your buyer.
4. Fill `.env` (see table below).
5. Optional: create a webhook at `https://your-url/api/paypal/webhook`, subscribe to `PAYMENT.CAPTURE.*` + `PAYMENT.AUTHORIZATION.*`, copy the webhook id.

> **Production note:** `PAYPAL_SPLIT_MODE=multi_unit` mirrors PayPal's marketplace pattern (distinct `payee` per purchase unit). On live PayPal this requires partner onboarding; `platform_fees` additionally requires PayPal Complete Payments Platform approval. `payout` mode works everywhere today.

---

## AI integration

| Feature | Implementation |
|---|---|
| **Listing autopilot** | `POST /api/ai/listing-autofill` — fetches a URL (repo/demo/landing page), extracts content, `generateObject` produces title/tagline/description/category/tech-stack/features. |
| **Price advisor** | `POST /api/ai/price-suggest` — LLM suggests a price range; cross-checked with real product prices from **Channel3**. |
| **Verification agent** | `POST /api/listings/:id/verify` — **KERNEL** spins up a real cloud Chromium, Playwright drives it through the demo URL, the LLM turns the run into a structured report + 0-100 quality score → "AI Verified" badge. |
| **Semantic search** | Listings are embedded (`text-embedding-3-small`) into **Elasticsearch** (`dense_vector` + kNN) combined with BM25 — genuine hybrid retrieval, with an honest SQL fallback. |
| **Buyer agent** | `POST /api/agent/chat` — `streamText` agent with marketplace tools (search, details) **and PayPal Agent Toolkit tools** (create/get orders, invoices). |
| **Brief refiner** | `POST /api/ai/refine-brief` — turns a buyer's rough description into a structured spec for developers. |

Any OpenAI-compatible endpoint works — set `OPENAI_API_KEY` (+ optionally `OPENAI_BASE_URL`/`OPENAI_MODEL` for OpenRouter/Groq/Ollama).

---

## Sponsor integrations

| Sponsor | Where |
|---|---|
| **PayPal** | Orders v2 split payments, AUTHORIZE/CAPTURE/VOID escrow, Payouts, Agent Toolkit, JS SDK, webhooks |
| **AG Grid** (Community) | `/dashboard` — `SalesGrid` transaction tables (filter/sort/paginate real order rows: seller share, platform fee, status) |
| **KERNEL** | `src/lib/kernel.ts` — cloud browser sessions driven by `playwright-core` over CDP; the AI verification agent |
| **Elastic** | `src/lib/elastic.ts` — index mapping (`dense_vector`, cosine), per-listing indexing, hybrid kNN+BM25 search, `/api/search/reindex` |
| **Channel3** | `src/app/api/channel3/benchmark` — real product prices compared to the listing price; `PriceBenchmark` component on listing pages |
| **Bryntum** | `BookingsCalendar` (`@bryntum/calendar-trial`) — demo-booking calendar on the dashboard; `DemoScheduler` books slots into the DB |
| **Render** | `render.yaml` blueprint — one-click deploy of the whole app |
| **Postman** | `postman/AgentBay.postman_collection.json` — every endpoint documented and runnable |
| **APIMatic** | PayPal context plugin used during development to ground API calls against the official spec |

---

## Run it locally

```bash
# 1. install
npm install

# 2. configure — copy and fill in real credentials
cp .env.example .env

# 3. database (SQLite — zero infra) + demo data
npm run db:migrate
npm run db:seed

# 4. go
npm run dev        # → http://localhost:3000
```

### Demo accounts (local seed only — all passwords `password123`, pre-verified)
| Account | Role |
|---|---|
| `admin@agentbay.dev` | platform admin — sees all transactions + fees |
| `alex@seller.dev`, `maria@seller.dev` | sellers with listings |
| `bob@buyer.dev` | buyer |

### Environment variables
| Var | Required | What |
|---|---|---|
| `DATABASE_URL` | ✔ | `file:./dev.db` locally; Postgres URL in production |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | ✔ | sandbox REST app credentials |
| `PAYPAL_PLATFORM_MERCHANT_ID` | ✔ | merchant id of the platform sandbox business account |
| `PAYPAL_SPLIT_MODE` | | `payout` (default, works everywhere) or `multi_unit` |
| `PLATFORM_FEE_BPS` | | commission, basis points (1000 = 10%) |
| `OPENAI_API_KEY` | for AI | any OpenAI-compatible key |
| `OPENAI_BASE_URL` | | ⚠️ leave **unset** for api.openai.com — empty string breaks the SDK |
| `AUTH_SECRET` | | session JWT secret |
| `KERNEL_API_KEY` | for verification | [onkernel.com](https://dashboard.onkernel.com) |
| `ELASTIC_URL` / `ELASTIC_API_KEY` | for semantic search | local docker or Elastic Cloud |
| `CHANNEL3_API_KEY` | for benchmarking | [trychannel3.com](https://trychannel3.com/developers) |
| `RESEND_API_KEY` | ✔ for email | [Resend](https://resend.com) key — verification, password-reset and welcome emails |
| `EMAIL_FROM` | | sender, default `AgentBay <market@adskings.com>` (adskings.com verified in Resend) |
| `APP_URL`, `PAYPAL_WEBHOOK_ID` | | deploy URL (used in emailed links) / webhook signature |

Missing optional credentials disable only that feature — PayPal keys, AI keys and the DB are the only hard requirements, and the app fails loudly with a clear message rather than silently degrading.

### Optional: Elasticsearch locally
```bash
docker run -d -p 9200:9200 -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" docker.elastic.co/elasticsearch/elasticsearch:9.1.0
# then POST /api/search/reindex as admin to embed + index all listings
```

---

## Accounts & email

- Sign-up creates the account and signs the user in, but it starts **unverified**: a real verification email is sent through Resend. Until the link is clicked the user can browse but cannot publish, buy, post requests, send offers, fund escrow or book demos (API returns `403 EMAIL_NOT_VERIFIED`; a banner offers *Resend email*).
- After verification a one-time **welcome email** is sent.
- **Forgot password** (`/forgot-password`) emails a single-use link valid for 1 hour; resetting signs the user out on every device.
- Tokens are stored only as SHA-256 hashes; resend / reset emails are throttled to one per minute per user.
- `/settings` — profile, PayPal payout details, password change.
- Sellers can publish **without** PayPal details; buyers can check out once the seller adds them (PayPal email in `payout` mode, Merchant ID in `multi_unit` mode).

## API surface

Everything is documented in the Postman collection (`postman/AgentBay.postman_collection.json`). Highlights:

```
POST /api/auth/{register,login,logout}      GET /api/auth/me   PATCH /api/profile
POST /api/auth/{forgot-password,reset-password,change-password,resend-verification}
GET  /api/auth/verify-email?token=…
POST /api/listings                          POST /api/listings/:id/verify
POST /api/ai/{listing-autofill,price-suggest,refine-brief}
POST /api/orders/{create,capture}           POST /api/paypal/webhook
POST /api/requests                          POST /api/requests/:id/offers
POST /api/custom-orders/{fund,authorize}    POST /api/custom-orders/:id/{deliver,accept,dispute}
GET  /api/search                            POST /api/search/reindex
POST /api/channel3/benchmark                POST /api/bookings
POST /api/agent/chat
```

## Deploy to Vercel

The app uses hosted **PostgreSQL** on Vercel and keeps **SQLite** for local
development. `prisma.config.ts` selects the connector from `DATABASE_URL` and
derives the PostgreSQL schema from the shared models. The two databases have
separate migration histories; the SQLite data is not copied to PostgreSQL.

1. Import `liviumarica/marketplace` into Vercel (framework: **Next.js**, root: `.`,
   Node.js: **24.x**).
2. Open the project's **Storage → Create Database** and connect a hosted
   PostgreSQL provider, such as **Neon**. Use its pooled PostgreSQL connection
   string as `DATABASE_URL`. For a provider that requires an unpooled migration
   connection, also set `DIRECT_URL`.
3. Add the environment variables below in **Settings → Environment Variables**.
   Use a separate database/branch for Preview deployments, since each build
   applies migrations to the database configured for that environment.

| Variable | Value |
|---|---|
| `DATABASE_URL` | Hosted PostgreSQL URL; never `file:./dev.db` on Vercel |
| `DIRECT_URL` | Optional direct PostgreSQL URL for migrations; Neon’s `DATABASE_URL_UNPOOLED` is used automatically when available |
| `AUTH_SECRET` | Random secret, at least 32 characters |
| `PAYPAL_ENV` | `sandbox` for the hackathon/demo |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials |
| `PAYPAL_PLATFORM_MERCHANT_ID` | Platform sandbox merchant ID |
| `PAYPAL_SPLIT_MODE` | `payout` |
| `PLATFORM_FEE_BPS` | `1000` |
| `APP_URL` | Public app URL, e.g. `https://your-project.vercel.app` |
| `OPENAI_API_KEY` | Required to use the AI features |
| `RESEND_API_KEY` | Required — verification / password-reset / welcome emails (the build fails without it) |
| `EMAIL_FROM` | Optional — defaults to `AgentBay <market@adskings.com>` (adskings.com must be verified in Resend) |

Generate an authentication secret locally with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

4. Deploy. `vercel.json` selects `npm run vercel-build`, which checks the DB/auth
   configuration, generates Prisma Client, applies PostgreSQL migrations, and
   builds Next.js. The default Next.js output settings can stay unchanged.
   `APP_URL` falls back to Vercel's deployment URL when omitted; set it explicitly
   for a stable production domain and PayPal return URLs.
5. Optionally configure `PAYPAL_WEBHOOK_ID` with a PayPal webhook pointing at
   `https://your-project.vercel.app/api/paypal/webhook`. Add the optional sponsor
   keys from `.env.example` for verification, semantic search, and benchmarking.

The deployment creates an empty database. For a **sandbox demo only**, set
`DATABASE_URL` to the hosted database in your local shell, then run:

```bash
npx prisma generate
npm run db:seed
```

The seed creates the public demo logins documented above, including an admin;
do not seed those accounts into a live-payment marketplace. Afterwards, unset
the shell override and run `npx prisma generate` to use local SQLite again.

Background verification and Elasticsearch indexing use Next.js `after()`;
the listing routes allow up to 300 seconds. Enable Vercel Fluid compute to
support that duration on the selected plan.

References: [Prisma on Vercel](https://docs.prisma.io/docs/orm/v6/prisma-client/deployment/serverless/deploy-to-vercel),
[Vercel Postgres integrations](https://vercel.com/docs/postgres).

## Deploy to Render

`New → Blueprint → this repo` — `render.yaml` provisions the web service; set the `sync:false` env vars in the dashboard. SQLite on instance disk is fine for a demo; for production point `DATABASE_URL` at a managed Postgres (`prisma migrate deploy` runs at boot).

## Repo map

```
src/app/            pages + API routes (App Router)
src/lib/            paypal, kernel, elastic, ai, auth, email, env, prisma
src/components/     PayPal buttons, AG Grid, Bryntum calendar, agent UI
prisma/             schema, migrations, seed
postman/            API collection
render.yaml         Render blueprint
```

## License

MIT — see [LICENSE](LICENSE).
