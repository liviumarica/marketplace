/**
 * Transactional email — sent for real through the Resend HTTPS API.
 *
 * We call the REST endpoint with `fetch` instead of adding an SDK: one POST
 * per email, no extra dependency. Every helper either delivers the message to
 * Resend or throws — there is no "pretend it was sent" path.
 *
 * Templates are intentionally simple, inline-styled HTML (email clients
 * ignore <style> blocks and external CSS) plus a plain-text alternative.
 */
import { env } from "@/lib/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Send one email via Resend. Returns the Resend message id. */
export async function sendEmail({ to, subject, html, text }: SendEmailInput): Promise<string> {
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.emailFrom, to: [to], subject, html, text }),
  });

  // Resend answers { id } on success and { name, message, statusCode } on error.
  const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !json.id) {
    throw new Error(`Resend rejected the email (${res.status}): ${json.message ?? "unknown error"}`);
  }
  return json.id;
}

// =============================================================================
// Templates
// =============================================================================

/** Escape user-controlled strings (names) before inserting them into HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Shared dark, on-brand layout: heading, paragraphs, optional call-to-action
 * button with the raw URL repeated below (some clients strip buttons).
 */
function layout(opts: { heading: string; paragraphs: string[]; cta?: { label: string; url: string }; footnote?: string }): string {
  const button = opts.cta
    ? `<p style="margin:28px 0"><a href="${opts.cta.url}" style="display:inline-block;background:linear-gradient(90deg,#8b5cf6,#22d3ee);color:#ffffff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:12px">${opts.cta.label}</a></p>
       <p style="font-size:12px;color:#9aa0c7;word-break:break-all">Or paste this link into your browser:<br><a href="${opts.cta.url}" style="color:#67e8f9">${opts.cta.url}</a></p>`
    : "";
  const footnote = opts.footnote
    ? `<p style="font-size:12px;color:#7d83ad;margin-top:24px">${opts.footnote}</p>`
    : "";
  return `<!doctype html>
<html><body style="margin:0;background:#05060f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e7e9ff">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <p style="font-size:18px;font-weight:700;margin:0 0 28px">Agent<span style="color:#a78bfa">Bay</span></p>
    <div style="background:#0d0f24;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px">
      <h1 style="font-size:22px;margin:0 0 16px;color:#ffffff">${opts.heading}</h1>
      ${opts.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.6;color:#c7cbf0;margin:0 0 12px">${p}</p>`).join("")}
      ${button}
      ${footnote}
    </div>
    <p style="font-size:11px;color:#5d628a;margin-top:24px">AgentBay — the marketplace for AI-built SaaS businesses.</p>
  </div>
</body></html>`;
}

/** "Confirm your email" — sent at sign-up and on "resend". */
export async function sendVerificationEmail(to: string, name: string, verifyUrl: string): Promise<string> {
  const safeName = escapeHtml(name);
  return sendEmail({
    to,
    subject: "Confirm your email for AgentBay",
    html: layout({
      heading: `Confirm your email, ${safeName}`,
      paragraphs: [
        "Thanks for signing up to AgentBay. Please confirm that this address belongs to you.",
        "Once confirmed you can publish listings, buy apps and post or accept custom builds.",
      ],
      cta: { label: "Confirm my email", url: verifyUrl },
      footnote: "The link is valid for 24 hours. If you didn't create an account, you can safely ignore this email.",
    }),
    text: `Hi ${name},\n\nConfirm your AgentBay email address by opening this link (valid for 24 hours):\n${verifyUrl}\n\nIf you didn't create an account, ignore this email.`,
  });
}

/** "Reset your password" — sent from the forgot-password page. */
export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string): Promise<string> {
  const safeName = escapeHtml(name);
  return sendEmail({
    to,
    subject: "Reset your AgentBay password",
    html: layout({
      heading: "Reset your password",
      paragraphs: [
        `Hi ${safeName}, we received a request to reset the password for your AgentBay account.`,
        "Click the button below to choose a new one. All other devices will be signed out.",
      ],
      cta: { label: "Choose a new password", url: resetUrl },
      footnote: "The link is valid for 1 hour and can be used once. If you didn't ask for this, ignore this email — your password stays the same.",
    }),
    text: `Hi ${name},\n\nReset your AgentBay password with this link (valid for 1 hour, single use):\n${resetUrl}\n\nIf you didn't ask for this, ignore this email.`,
  });
}

/** "Welcome" — sent once, right after the email address is confirmed. */
export async function sendWelcomeEmail(to: string, name: string, appUrl: string): Promise<string> {
  const safeName = escapeHtml(name);
  return sendEmail({
    to,
    subject: "Welcome to AgentBay",
    html: layout({
      heading: `Welcome aboard, ${safeName}!`,
      paragraphs: [
        "Your email is confirmed and your account is fully active.",
        "<strong style=\"color:#fff\">Selling?</strong> Paste a repo or demo URL and the AI autopilot writes your listing. Add your PayPal payout details in Settings so buyers can check out.",
        "<strong style=\"color:#fff\">Buying?</strong> Browse AI-verified apps, book a live demo with the seller, or post a brief and get a custom app built with your money held safely in PayPal escrow.",
      ],
      cta: { label: "Open AgentBay", url: appUrl },
    }),
    text: `Welcome aboard, ${name}!\n\nYour email is confirmed and your account is fully active.\n\nSelling? Paste a repo or demo URL and the AI writes your listing. Add your PayPal payout details in Settings so buyers can check out.\nBuying? Browse AI-verified apps or post a custom brief.\n\n${appUrl}`,
  });
}
