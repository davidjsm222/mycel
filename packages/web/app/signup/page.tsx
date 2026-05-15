import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  authLink,
  btnPrimary,
  fieldLabel,
  inputClass,
} from "@/lib/auth-form-classes";
import { MycelWordmark } from "@/components/mycel-wordmark";

import { signupAction } from "./actions";

type Props = {
  searchParams: { next?: string; error?: string; notice?: string };
};

export default async function SignupPage({ searchParams }: Props) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(searchParams.next?.startsWith("/") ? searchParams.next : "/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 dark:bg-zinc-950">
      <div className="w-full max-w-[400px] rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-8 flex justify-center">
          <MycelWordmark href="/signup" />
        </div>

        <h1 className="text-center text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Create account
        </h1>
        <p className="mb-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Email and password. If your project requires email confirmation, we will
          show a note after sign up.
        </p>

        {searchParams.notice ? (
          <p
            className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
            role="status"
          >
            {searchParams.notice}
          </p>
        ) : null}

        {searchParams.error ? (
          <p
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
            role="alert"
          >
            {searchParams.error}
          </p>
        ) : null}

        <form action={signupAction} className="space-y-4">
          <input type="hidden" name="next" value={searchParams.next ?? ""} />
          <div>
            <label htmlFor="email" className={fieldLabel}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className={inputClass}
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className={fieldLabel}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
              placeholder="••••••••"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              At least 8 characters.
            </p>
          </div>
          <div>
            <label htmlFor="confirmPassword" className={fieldLabel}>
              Confirm password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Create account
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href="/login" className={authLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
