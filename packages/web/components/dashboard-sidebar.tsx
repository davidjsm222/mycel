import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { MycelWordmark } from "./mycel-wordmark";

import { signOutAction } from "@/app/dashboard/actions";

export async function DashboardSidebar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const navCls =
    "block rounded-md px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex h-14 items-center border-b border-zinc-200 px-4 dark:border-zinc-800">
        <MycelWordmark href="/dashboard" />
      </div>
      <nav className="flex-1 p-3">
        <Link href="/dashboard" className={navCls}>
          Agents
        </Link>
      </nav>
      <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
        <p
          className="mb-2 truncate text-xs text-zinc-500 dark:text-zinc-400"
          title={user?.email ?? ""}
        >
          {user?.email ?? "—"}
        </p>
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
