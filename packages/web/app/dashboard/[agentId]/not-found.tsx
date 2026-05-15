import Link from "next/link";

export default function AgentNotFound() {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-12 lg:px-8">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">Agent not found.</p>
      <Link
        href="/dashboard"
        className="mt-4 text-sm font-medium text-zinc-900 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:text-zinc-100 dark:decoration-zinc-600"
      >
        ← Back to agents
      </Link>
    </div>
  );
}
