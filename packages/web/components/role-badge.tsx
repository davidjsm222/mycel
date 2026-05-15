export function RoleBadge({ role }: { role: string }) {
  return (
    <span className="inline-flex shrink-0 rounded px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-wide text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:text-zinc-400 dark:ring-zinc-700">
      {role}
    </span>
  );
}
