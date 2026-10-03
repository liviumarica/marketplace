import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { getSessionUser } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentBay — Marketplace for AI-built SaaS",
  description:
    "Buy complete AI-built SaaS businesses or order a custom app built by AI-augmented developers. Payments split automatically via PayPal.",
};

/**
 * Root layout — renders the global navbar (session-aware) around every page.
 */
export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getSessionUser();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Navbar
          user={
            user
              ? { name: user.name, email: user.email, role: user.role }
              : null
          }
        />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          AgentBay — PayPal AI Hackathon project · PayPal + AI · Sandbox payments
        </footer>
      </body>
    </html>
  );
}
