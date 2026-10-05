<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project notes

- Verify changes with: `npx tsc --noEmit -p .`, `npx eslint src`, `npx next build`.
- Prisma: SQLite locally (`prisma/migrations`), PostgreSQL on Vercel (`prisma/migrations-postgresql`). Every schema change needs a migration in BOTH folders (`npx prisma migrate dev` for SQLite; write the PostgreSQL SQL and check it with `prisma migrate diff --from-schema-datamodel old --to-schema-datamodel new --script`).
- On Windows, a running dev server locks `src/generated/prisma/query_engine-windows.dll.node`, so `prisma generate` hits EPERM. Stop the dev server first.
- Email goes through Resend (`src/lib/email.ts`; needs `RESEND_API_KEY` and `EMAIL_FROM`). Transactional API routes call `emailVerificationRequired(user)` from `src/lib/auth.ts`.
