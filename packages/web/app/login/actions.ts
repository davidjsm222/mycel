"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nextRaw = String(formData.get("next") ?? "").trim();
  const safeNext =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/dashboard";

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Email and password are required.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(safeNext);
}
