"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function safeRedirectPath(raw: string | undefined): string {
  const t = raw?.trim() ?? "";
  return t.startsWith("/") && !t.startsWith("//") ? t : "/dashboard";
}

function getOriginEmailRedirect(): string | undefined {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) {
    return undefined;
  }
  const proto =
    host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : (h.get("x-forwarded-proto") ?? "https").split(",")[0].trim();

  try {
    return `${proto}://${host}/dashboard`;
  } catch {
    return undefined;
  }
}

export async function signupAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();
  const safeNext = safeRedirectPath(nextRaw);

  if (!email || !password) {
    redirect(
      `/signup?error=${encodeURIComponent("Email and password are required.")}`,
    );
  }
  if (password !== confirmPassword) {
    redirect(
      `/signup?error=${encodeURIComponent("Passwords do not match.")}`,
    );
  }
  if (password.length < 8) {
    redirect(
      `/signup?error=${encodeURIComponent(
        "Password must be at least 8 characters.",
      )}`,
    );
  }

  const supabase = createClient();
  const emailRedirectTo = getOriginEmailRedirect();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo ? { emailRedirectTo } : undefined,
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect(safeNext);
  }

  redirect(
    `/signup?notice=${encodeURIComponent(
      "Check your email to confirm your account, then sign in.",
    )}`,
  );
}
