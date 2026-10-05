/**
 * /settings — the user's profile & account settings:
 *   - profile (name, bio) and email verification status,
 *   - PayPal payout details (needed before buyers can check out),
 *   - password change.
 * Server component: loads the fresh user row, then hands plain values to
 * the client forms (never the password hash).
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { isPayoutReady } from "@/lib/payout";
import { PageTransition } from "@/components/fx/PageTransition";
import { PageHeader } from "@/components/fx/PageHeader";
import { SettingsForms } from "./SettingsForms";

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl px-4 py-10">
        <PageHeader
          eyebrow="Account"
          title="Settings"
          subtitle="Manage your profile, how you get paid, and your password."
        />
        <SettingsForms
          initial={{
            name: user.name,
            email: user.email,
            bio: user.bio ?? "",
            emailVerified: Boolean(user.emailVerifiedAt),
            paypalEmail: user.paypalEmail ?? "",
            paypalMerchantId: user.paypalMerchantId ?? "",
            payoutReady: isPayoutReady(user),
            splitMode: env.paypalSplitMode,
          }}
        />
      </div>
    </PageTransition>
  );
}
