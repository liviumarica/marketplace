/**
 * /login — server wrapper around the client login form.
 * Already signed-in users are sent straight to their dashboard instead of
 * seeing a login form for an account they are already using.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSessionUser()) redirect("/dashboard");

  // ?reset=success is set by the reset-password page after a new password.
  const { reset } = await searchParams;
  const notice =
    reset === "success"
      ? "Your password was changed. Log in with your new password."
      : null;

  return <LoginForm notice={notice} />;
}
