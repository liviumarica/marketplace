/**
 * /register — server wrapper around the client sign-up form.
 * Already signed-in users are redirected to their dashboard.
 */
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  if (await getSessionUser()) redirect("/dashboard");
  return <RegisterForm />;
}
