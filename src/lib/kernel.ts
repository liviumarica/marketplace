/**
 * KERNEL verification agent — the marketplace's killer feature.
 *
 * When a seller lists an app with a demo URL, an autonomous agent:
 *   1. Spins up a real browser session in KERNEL's cloud
 *   2. Drives it over CDP with Playwright — loads the app, exercises the UI,
 *      collects evidence (status, title, text, element counts, console errors,
 *      a real screenshot)
 *   3. Has an LLM evaluate the evidence into a structured report + score
 *   4. Issues the "AI Verified" badge and activates the listing
 *
 * Every step is real — no simulated results. If KERNEL_API_KEY is missing the
 * run fails honestly with a clear explanation.
 */
import Kernel from "@onkernel/sdk";
import { chromium } from "playwright-core";
import { generateObject } from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { chatModel } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

/** Structured report the agent produces for a verification run. */
const reportSchema = z.object({
  checks: z
    .array(
      z.object({
        name: z.string(),
        passed: z.boolean(),
        note: z.string().describe("Short explanation of the result; empty string if nothing to add"),
      }),
    )
    .describe("Individual checks the agent performed"),
  summary: z
    .string()
    .describe("1-2 sentence overall assessment of the app"),
  qualityScore: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("0-100 quality score based on the evidence"),
  verdict: z
    .enum(["PASSED", "FAILED"])
    .describe("PASSED if the app demonstrably works"),
});

export type VerificationReport = z.infer<typeof reportSchema>;

/** Evidence gathered by actually driving the app in a cloud browser. */
interface BrowserEvidence {
  httpStatus: number | null;
  pageTitle: string;
  visibleText: string;
  counts: {
    links: number;
    buttons: number;
    inputs: number;
    forms: number;
    images: number;
  };
  severeConsoleErrors: string[];
  screenshotDataUri: string | null;
  loadMs: number;
}

/**
 * Drive the demo URL in a KERNEL cloud browser and collect hard evidence.
 */
async function collectEvidence(demoUrl: string): Promise<{
  evidence: BrowserEvidence;
  sessionId: string | null;
}> {
  const kernel = new Kernel({ apiKey: env.kernelApiKey });

  // Spin up a real headless Chromium in KERNEL's cloud.
  const session = await kernel.browsers.create({
    headless: true,
    stealth: true, // avoid bot detection on protected demo sites
    timeout_seconds: 300,
  });

  let browser;
  try {
    // Drive it over the Chrome DevTools Protocol with Playwright.
    browser = await chromium.connectOverCDP(session.cdp_ws_url);
    const context = browser.contexts()[0] ?? (await browser.newContext());
    const page = await context.newPage();

    const severeErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") severeErrors.push(msg.text().slice(0, 200));
    });
    page.on("pageerror", (err) =>
      severeErrors.push(`pageerror: ${String(err).slice(0, 200)}`),
    );

    const started = Date.now();
    const response = await page.goto(demoUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    const loadMs = Date.now() - started;

    // Give client-side apps a moment to hydrate, then read the page.
    await page.waitForTimeout(3000);

    const [pageTitle, visibleText, counts] = await Promise.all([
      page.title(),
      page
        .evaluate(() => document.body?.innerText ?? "")
        .then((t) => t.slice(0, 4000)),
      page.evaluate(() => ({
        links: document.querySelectorAll("a").length,
        buttons: document.querySelectorAll("button").length,
        inputs: document.querySelectorAll("input").length,
        forms: document.querySelectorAll("form").length,
        images: document.querySelectorAll("img").length,
      })),
    ]);

    // A real screenshot of what the agent saw — stored with the report.
    const shot = await page.screenshot({ type: "jpeg", quality: 60 });
    const screenshotDataUri = `data:image/jpeg;base64,${shot.toString("base64")}`;

    return {
      sessionId: session.session_id,
      evidence: {
        httpStatus: response?.status() ?? null,
        pageTitle,
        visibleText,
        counts,
        severeConsoleErrors: severeErrors.slice(0, 10),
        screenshotDataUri,
        loadMs,
      },
    };
  } finally {
    await browser?.close().catch(() => {});
    // Always release the cloud session — KERNEL bills per session.
    await kernel.browsers.deleteByID(session.session_id).catch(() => {});
  }
}

/**
 * Run a full verification for a listing and persist the outcome.
 * Safe to call fire-and-forget; it updates the listing + a VerificationRun
 * row that the UI polls/renders.
 */
export async function runListingVerification(listingId: string): Promise<void> {
  const listing = await prisma.listing.findUnique({ where: { id: listingId } });
  if (!listing) return;

  const run = await prisma.verificationRun.create({
    data: { listingId, status: "RUNNING" },
  });
  await prisma.listing.update({
    where: { id: listingId },
    data: { verificationStatus: "RUNNING" },
  });

  try {
    if (!listing.demoUrl) {
      throw new Error("Listing has no demo URL to verify");
    }
    if (!env.kernelApiKey) {
      throw new Error(
        "KERNEL_API_KEY is not configured — verification needs a real KERNEL key",
      );
    }

    // 1) Real browser session → hard evidence.
    const { evidence, sessionId } = await collectEvidence(listing.demoUrl);
    await prisma.verificationRun.update({
      where: { id: run.id },
      data: { kernelSessionId: sessionId },
    });

    // 2) LLM evaluates the evidence into a structured report.
    const { object: report } = await generateObject({
      model: chatModel(),
      schema: reportSchema,
      prompt:
        `You are a QA agent verifying that a SaaS app listed for sale actually ` +
        `works. An autonomous browser just visited the app's demo URL and ` +
        `collected this evidence:\n\n` +
        JSON.stringify({ ...evidence, screenshotDataUri: "[screenshot captured]" }, null, 2) +
        `\n\nEvaluate whether the app demonstrably loads and functions. ` +
        `Include checks for: page loads successfully, has meaningful content, ` +
        `has interactive UI (buttons/forms/links), no fatal JS errors, loads ` +
        `in reasonable time. Score 0-100; PASSED only if it clearly works.`,
    });

    const passed = report.verdict === "PASSED";

    await prisma.$transaction([
      prisma.verificationRun.update({
        where: { id: run.id },
        data: {
          status: report.verdict,
          report: JSON.stringify({
            ...report,
            evidence: { ...evidence, screenshotDataUri: undefined },
            screenshotDataUri: evidence.screenshotDataUri,
          }),
          qualityScore: report.qualityScore,
          completedAt: new Date(),
        },
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: {
          verificationStatus: report.verdict,
          aiQualityScore: report.qualityScore,
          // A passing verification activates a pending listing; failures keep
          // the seller informed but don't auto-publish.
          ...(listing.status === "PENDING_REVIEW" && passed
            ? { status: "ACTIVE" }
            : {}),
        },
      }),
    ]);
  } catch (err) {
    // Honest failure — record what went wrong so the seller can fix & retry.
    await prisma.$transaction([
      prisma.verificationRun.update({
        where: { id: run.id },
        data: {
          status: "FAILED",
          report: JSON.stringify({
            checks: [
              {
                name: "Verification run",
                passed: false,
                note: err instanceof Error ? err.message : String(err),
              },
            ],
            summary: "The verification agent could not complete its checks.",
            qualityScore: 0,
            verdict: "FAILED",
          }),
          completedAt: new Date(),
        },
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: { verificationStatus: "FAILED" },
      }),
    ]);
  }
}
