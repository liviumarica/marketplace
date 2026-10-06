"use client";

/**
 * Client forms for /settings. Each section saves independently through a
 * real API call and shows its own success / error message:
 *   Profile  → PATCH /api/profile { name, bio }
 *   Payouts  → PATCH /api/profile { paypalEmail, paypalMerchantId }
 *   Security → POST  /api/auth/change-password
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Reveal } from "@/components/fx/Reveal";

interface SettingsInitial {
  name: string;
  email: string;
  bio: string;
  emailVerified: boolean;
  paypalEmail: string;
  paypalMerchantId: string;
  payoutReady: boolean;
  splitMode: "payout" | "multi_unit";
}

/** Per-section feedback: null = nothing to show. */
type Feedback = { ok: boolean; text: string } | null;

/** Small helper: send JSON, return [ok, errorMessage]. */
async function sendJson(url: string, method: "PATCH" | "POST", body: unknown): Promise<[boolean, string]> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return [res.ok, json.error ?? "Something went wrong"];
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <p className={feedback.ok ? "alert-success" : "alert-error"}>{feedback.text}</p>;
}

export function SettingsForms({ initial }: { initial: SettingsInitial }) {
  const router = useRouter();

  // ---- Profile -----------------------------------------------------------
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileMsg, setProfileMsg] = useState<Feedback>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileBusy(true);
    const [ok, err] = await sendJson("/api/profile", "PATCH", { name, bio });
    setProfileBusy(false);
    setProfileMsg(ok ? { ok, text: "Profile saved." } : { ok, text: err });
    // Re-render server components (navbar / dashboard greet by name).
    if (ok) router.refresh();
  }

  // ---- Resend verification ------------------------------------------------
  const [verifyMsg, setVerifyMsg] = useState<Feedback>(null);
  async function resendVerification() {
    const [ok, err] = await sendJson("/api/auth/resend-verification", "POST", {});
    setVerifyMsg(ok ? { ok, text: `Verification link sent to ${initial.email}.` } : { ok, text: err });
  }

  // ---- Payouts -----------------------------------------------------------
  const [paypalEmail, setPaypalEmail] = useState(initial.paypalEmail);
  const [paypalMerchantId, setPaypalMerchantId] = useState(initial.paypalMerchantId);
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<Feedback>(null);

  async function savePayouts(e: React.FormEvent) {
    e.preventDefault();
    setPayoutBusy(true);
    const [ok, err] = await sendJson("/api/profile", "PATCH", { paypalEmail, paypalMerchantId });
    setPayoutBusy(false);
    setPayoutMsg(ok ? { ok, text: "Payout details saved." } : { ok, text: err });
    if (ok) router.refresh();
  }

  // ---- Password ----------------------------------------------------------
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<Feedback>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwMsg({ ok: false, text: "The two new passwords don't match" });
      return;
    }
    setPwBusy(true);
    const [ok, err] = await sendJson("/api/auth/change-password", "POST", { currentPassword, newPassword });
    setPwBusy(false);
    if (ok) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwMsg(ok ? { ok, text: "Password changed. Other devices have been signed out." } : { ok, text: err });
  }

  // Which payout field actually unlocks checkout in the current split mode.
  const needsMerchantId = initial.splitMode === "multi_unit";

  return (
    <div className="mt-10 space-y-8">
      {/* ================= Profile ================= */}
      {/* y={0}: fade only — fields must never move under the cursor */}
      <Reveal y={0}>
        <form onSubmit={saveProfile} className="glass space-y-5 rounded-3xl p-7">
          <h2 className="text-xl font-semibold text-white">Profile</h2>

          <div className="field-label">
            Email
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-sm text-white/80">{initial.email}</span>
              {initial.emailVerified ? (
                <span className="chip chip-green">✓ Verified</span>
              ) : (
                <>
                  <span className="chip chip-amber">Not verified</span>
                  <button type="button" onClick={resendVerification} className="link-neon text-xs">
                    Resend verification email
                  </button>
                </>
              )}
            </div>
          </div>
          <FeedbackLine feedback={verifyMsg} />

          <label className="field-label">
            Display name
            <input required value={name} onChange={(e) => setName(e.target.value)} className="field" />
          </label>
          <label className="field-label">
            Bio (shown to buyers and developers)
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Indie maker building AI-assisted SaaS tools…"
              className="field"
            />
          </label>
          <FeedbackLine feedback={profileMsg} />
          <button type="submit" disabled={profileBusy} className="btn-primary">
            {profileBusy ? "Saving…" : "Save profile"}
          </button>
        </form>
      </Reveal>

      {/* ================= Payouts ================= */}
      {/* y={0}: fade only — fields must never move under the cursor */}
      <Reveal y={0} delay={0.08}>
        <form id="payouts" onSubmit={savePayouts} className="glass scroll-mt-28 space-y-5 rounded-3xl p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-white">PayPal payouts</h2>
            {initial.payoutReady ? (
              <span className="chip chip-green">✓ Ready to get paid</span>
            ) : (
              <span className="chip chip-amber">Setup needed before your first sale</span>
            )}
          </div>
          <p className="text-muted text-sm">
            You can publish listings without this. Buyers can check out once your{" "}
            {needsMerchantId ? "PayPal Merchant ID" : "PayPal email"} is saved — that&apos;s where your
            90% share is sent.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              PayPal email{needsMerchantId ? "" : " *"}
              <input
                type="email"
                value={paypalEmail}
                onChange={(e) => setPaypalEmail(e.target.value)}
                placeholder="you@business.example.com"
                className="field"
              />
            </label>
            <label className="field-label">
              Merchant ID{needsMerchantId ? " *" : " (optional)"}
              <input
                value={paypalMerchantId}
                onChange={(e) => setPaypalMerchantId(e.target.value)}
                placeholder="ABC123DEF456"
                className="field"
              />
            </label>
          </div>
          <FeedbackLine feedback={payoutMsg} />
          <button type="submit" disabled={payoutBusy} className="btn-primary">
            {payoutBusy ? "Saving…" : "Save payout details"}
          </button>
        </form>
      </Reveal>

      {/* ================= Security ================= */}
      {/* y={0}: fade only — fields must never move under the cursor */}
      <Reveal y={0} delay={0.16}>
        <form onSubmit={changePassword} className="glass space-y-5 rounded-3xl p-7">
          <h2 className="text-xl font-semibold text-white">Password</h2>
          <label className="field-label">
            Current password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="field"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="field-label">
              New password (min 8 chars)
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="field"
              />
            </label>
            <label className="field-label">
              Confirm new password
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="field"
              />
            </label>
          </div>
          <FeedbackLine feedback={pwMsg} />
          <button type="submit" disabled={pwBusy} className="btn-primary">
            {pwBusy ? "Saving…" : "Change password"}
          </button>
        </form>
      </Reveal>
    </div>
  );
}
