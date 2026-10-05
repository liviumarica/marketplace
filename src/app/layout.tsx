import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/fx/SmoothScroll";
import { CosmicBackground } from "@/components/fx/CosmicBackground";
import { ScrollProgress } from "@/components/fx/ScrollProgress";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { getSessionUser } from "@/lib/auth";

// Body copy font.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Monospace font for prices, ids and technical labels.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display font for headlines — geometric and futuristic.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "AgentBay — Marketplace for AI-built SaaS",
  description:
    "Buy complete AI-built SaaS businesses or order a custom app built by AI-augmented developers. Payments split automatically via PayPal.",
};

// Dark browser chrome (mobile address bar etc.) to match the cosmic theme.
export const viewport: Viewport = {
  themeColor: "#05060f",
  colorScheme: "dark",
};

/**
 * Root layout — the persistent "cosmic" shell around every page:
 *   - animated aurora/star background + cursor spotlight,
 *   - Lenis smooth scrolling and a scroll-progress bar,
 *   - the session-aware floating navbar and the footer.
 * Page content animates in/out via <PageTransition> inside each page.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col overflow-x-hidden bg-void text-ink">
        <SmoothScroll />
        <ScrollProgress />
        <CosmicBackground />
        <Navbar
          user={
            user
              ? { name: user.name, email: user.email, role: user.role }
              : null
          }
        />
        {/* Top padding leaves room for the floating navbar. */}
        <main className="flex-1 pt-24">{children}</main>
        <Footer />
        {/* Reminder for signed-in users who haven't confirmed their email. */}
        {user && !user.emailVerifiedAt && <VerifyEmailBanner email={user.email} />}
      </body>
    </html>
  );
}
