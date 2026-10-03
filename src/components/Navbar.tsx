"use client";

/**
 * Global navigation bar.
 * Shows marketplace links plus session-dependent actions (login/logout,
 * dashboard, sell). Logout is a real POST to /api/auth/logout.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NavbarProps {
  user: { name: string; email: string; role: string } | null;
}

export function Navbar({ user }: NavbarProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-white text-sm">
              AB
            </span>
            AgentBay
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-slate-600 md:flex">
            <Link href="/" className="hover:text-slate-900">
              Browse apps
            </Link>
            <Link href="/requests" className="hover:text-slate-900">
              Custom builds
            </Link>
            <Link href="/chat" className="hover:text-slate-900">
              AI Shopping Agent
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-slate-600 hover:text-slate-900"
              >
                Dashboard
              </Link>
              <Link
                href="/listings/new"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                Sell your app
              </Link>
              <button
                onClick={logout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                title={user.email}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-600 hover:text-slate-900"
              >
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-700"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
