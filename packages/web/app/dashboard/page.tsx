import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

import { NewAgentButton } from "@/components/new-agent-button";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: agents, error } = await supabase
    .from("agents")
    .select("id, display_name, api_key_prefix, created_at")
    .order("created_at", { ascending: false });

  const cardCls =
    "block rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700";

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-6 py-6 lg:px-8 dark:border-zinc-800">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your agents
        </h1>
        <div className="flex flex-col items-end gap-2">
          <NewAgentButton />
        </div>
      </header>

      <div className="flex-1 px-6 py-6 lg:px-8 lg:py-8">
        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            Could not load agents: {error.message}
          </p>
        ) : (agents ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No agents yet. Create one with <strong>New agent</strong>.
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(agents ?? []).map((a) => (
              <li key={a.id}>
                <Link href={`/dashboard/${a.id}`} className={cardCls}>
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {a.display_name}
                  </div>
                  <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                    {a.api_key_prefix ?? "—"}
                  </div>
                  <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
                    Added {formatDateTime(a.created_at)}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
