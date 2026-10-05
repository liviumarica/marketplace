/**
 * POST /api/auth/logout — clear the session cookie.
 *
 * Two kinds of callers:
 *   - the navbar's plain HTML <form method="post"> → we answer with a 303
 *     redirect to the home page, so the browser performs a full navigation
 *     and every server component re-renders without the session (no stale
 *     client router cache, works even with JavaScript disabled);
 *   - API clients (fetch / Postman) → JSON `{ ok: true }`.
 */
import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await clearSessionCookie();

  const contentType = req.headers.get("content-type") ?? "";
  const isFormPost =
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data");

  if (isFormPost) {
    // 303 turns the POST into a GET of "/" in the browser.
    return NextResponse.redirect(new URL("/", req.url), 303);
  }
  return NextResponse.json({ ok: true });
}
