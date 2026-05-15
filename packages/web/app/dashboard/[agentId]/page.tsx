import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/format";

import { RoleBadge } from "@/components/role-badge";

type Props = {
  params: { agentId: string };
};

export default async function AgentMemoriesPage({ params }: Props) {
  const supabase = createClient();

  const { data: agent, error: agentErr } = await supabase
    .from("agents")
    .select("id, display_name, api_key_prefix")
    .eq("id", params.agentId)
    .maybeSingle();

  if (agentErr || !agent) {
    notFound();
  }

  const { data: memories, error } = await supabase
    .from("memories")
    .select("id, role, content, created_at")
    .eq("agent_id", params.agentId)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <div className="border-b border-zinc-200 px-6 py-6 lg:px-8 dark:border-zinc-800">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Dashboard
        </Link>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {agent.display_name}
        </h1>
        <p className="mt-1 font-mono text-sm text-zinc-500 dark:text-zinc-400">
          {agent.api_key_prefix ?? "—"}
        </p>
      </div>

      <div className="flex-1 space-y-4 px-6 py-6 lg:px-8 lg:py-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          Memory log
        </h2>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200"
            role="alert"
          >
            Could not load memories: {error.message}
          </p>
        ) : (memories ?? []).length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No memories for this agent yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {(memories ?? []).map((m) => (
              <li
                key={m.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <RoleBadge role={m.role ?? "note"} />
                  <time
                    className="text-xs tabular-nums text-zinc-500 dark:text-zinc-500"
                    dateTime={m.created_at ?? undefined}
                  >
                    {formatDateTime(m.created_at)}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {m.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
