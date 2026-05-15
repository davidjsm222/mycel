import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { MycelWordmark } from "@/components/mycel-wordmark";

import { loginAction } from "./actions";

const fieldLabel =
  "mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300";
const inputClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-950/15 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:ring-white/15";
const btnPrimary =
  "w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

type Props = {
  searchParams: { next?: string; error?: string };
};

export default async function LoginPage({ searchParams }: Props) {
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
          <MycelWordmark asLink />
        </div>

        <h1 className="sr-only">Sign in</h1>

        {searchParams.error ? (
          <p
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/60 dark:text-red-200"
            role="alert"
          >
            {searchParams.error}
          </p>
        ) : null}

        <form action={loginAction} className="space-y-4">
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
              autoComplete="current-password"
              required
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
          <button type="submit" className={btnPrimary}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
