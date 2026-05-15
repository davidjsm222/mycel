"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createAgentAction } from "@/app/dashboard/actions";

function ApiKeyModal({
  apiKey,
  onClose,
}: {
  apiKey: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-key-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <h2
          id="api-key-modal-title"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          API key
        </h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Copy now. This secret is shown once and cannot be retrieved again.
        </p>
        <pre className="mt-4 max-h-32 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
          {apiKey}
        </pre>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewAgentButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalKey, setModalKey] = useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    setPending(true);
    try {
      const r = await createAgentAction();
      if (r.ok) {
        setModalKey(r.apiKey);
        router.refresh();
      } else {
        setError(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      {error ? (
        <p className="text-right text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        onClick={handleCreate}
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Creating…" : "New agent"}
      </button>
      {modalKey ? (
        <ApiKeyModal apiKey={modalKey} onClose={() => setModalKey(null)} />
      ) : null}
    </>
  );
}
