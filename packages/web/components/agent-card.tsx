"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteAgent, updateAgentName } from "@/app/dashboard/actions";

const inputCls =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-950/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:ring-white/15";

const btnGhost =
  "rounded-md px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

const btnPrimarySm =
  "rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

const btnDangerSm =
  "rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500";

type Mode = "view" | "edit" | "delete-confirm";

type Props = {
  id: string;
  displayName: string;
  apiKeyPrefix: string | null;
  createdAtFormatted: string;
};

export function AgentCard({
  id,
  displayName: initialDisplayName,
  apiKeyPrefix,
  createdAtFormatted,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [draft, setDraft] = useState(initialDisplayName);
  const [name, setName] = useState(initialDisplayName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setError(null);
    setDraft(name);
    setMode("edit");
  }

  function cancelEdit() {
    setDraft(name);
    setMode("view");
    setError(null);
  }

  async function saveName() {
    setError(null);
    setPending(true);
    try {
      const r = await updateAgentName(id, draft);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setName(draft.trim());
      setMode("view");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  function askDelete() {
    setError(null);
    setMode("delete-confirm");
  }

  function cancelDelete() {
    setMode("view");
    setError(null);
  }

  async function confirmDelete() {
    setError(null);
    setPending(true);
    try {
      const r = await deleteAgent(id);
      if (r?.ok === false) {
        setError(r.error);
      }
    } catch {
      /* Successful delete triggers redirect (NEXT_REDIRECT). */
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="min-h-[1.75rem]">
        {mode === "edit" ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              className={inputCls}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={pending}
              aria-label="Agent name"
              autoFocus
            />
            <button
              type="button"
              className={btnPrimarySm}
              disabled={pending}
              onClick={saveName}
            >
              Save
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={pending}
              onClick={cancelEdit}
            >
              Cancel
            </button>
          </div>
        ) : (
          <Link
            href={`/dashboard/${id}`}
            className="font-medium text-zinc-900 hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-200"
          >
            {name}
          </Link>
        )}
      </div>

      <div className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">
        {apiKeyPrefix ?? "—"}
      </div>
      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-500">
        Added {createdAtFormatted}
      </div>

      {error ? (
        <p
          className="mt-2 text-xs text-red-600 dark:text-red-400"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {mode === "view" ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button
            type="button"
            className={btnGhost}
            onClick={startEdit}
          >
            Edit name
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={askDelete}
          >
            Delete
          </button>
        </div>
      ) : null}

      {mode === "delete-confirm" ? (
        <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            Are you sure?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={btnDangerSm}
              disabled={pending}
              onClick={confirmDelete}
            >
              Delete agent
            </button>
            <button
              type="button"
              className={btnGhost}
              disabled={pending}
              onClick={cancelDelete}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
