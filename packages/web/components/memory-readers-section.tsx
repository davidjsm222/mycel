"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  addMemoryReaderAction,
  revokeMemoryReaderAction,
} from "@/app/dashboard/[agentId]/memory-access-actions";

const btnPrimarySm =
  "rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200";

const btnDangerSm =
  "rounded-md border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40";

const selectCls =
  "min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100";

export type PeerOption = {
  id: string;
  display_name: string;
  api_key_prefix: string | null;
};

export type GrantRow = {
  granted_agent_id: string;
  display_name: string;
  api_key_prefix: string | null;
};

function shortId(id: string): string {
  return id.replace(/-/g, "").slice(0, 8);
}

type Props = {
  sourceAgentId: string;
  grants: GrantRow[];
  peerOptions: PeerOption[];
};

export function MemoryReadersSection({
  sourceAgentId,
  grants,
  peerOptions,
}: Props) {
  const router = useRouter();
  const [selectedPeer, setSelectedPeer] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const grantedSet = new Set(grants.map((g) => g.granted_agent_id));
  const addablePeers = peerOptions.filter((p) => !grantedSet.has(p.id));

  async function onAddReader() {
    if (!selectedPeer) {
      setError("Choose an agent.");
      return;
    }
    setError(null);
    setPending(true);
    try {
      const r = await addMemoryReaderAction(sourceAgentId, selectedPeer);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setSelectedPeer("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onRevoke(grantedId: string) {
    setError(null);
    setPending(true);
    try {
      const r = await revokeMemoryReaderAction(sourceAgentId, grantedId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
          Memory readers
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Choose which of your other agents may call{" "}
          <span className="font-mono text-xs">read_memory</span> /{" "}
          <span className="font-mono text-xs">GET /memories</span> against this agent&apos;s
          memory. Both agents must belong to you.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}

      {addablePeers.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          No other agents to add. Create another agent on the dashboard.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="reader-peer" className="sr-only">
            Add reader agent
          </label>
          <select
            id="reader-peer"
            value={selectedPeer}
            disabled={pending}
            onChange={(e) => setSelectedPeer(e.target.value)}
            className={selectCls}
          >
            <option value="">Select agent…</option>
            {addablePeers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name} ({p.api_key_prefix ?? shortId(p.id)})
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !selectedPeer}
            className={btnPrimarySm}
            onClick={onAddReader}
          >
            Grant read access
          </button>
        </div>
      )}

      {grants.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          No other agents can read this memory yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {grants.map((g) => (
            <li
              key={g.granted_agent_id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {g.display_name}
                </span>
                <span className="ml-2 font-mono text-xs text-zinc-500">
                  {g.api_key_prefix ?? "—"}
                </span>
                <div className="mt-0.5 font-mono text-[11px] text-zinc-400">
                  {shortId(g.granted_agent_id)}… {g.granted_agent_id}
                </div>
              </div>
              <button
                type="button"
                className={btnDangerSm}
                disabled={pending}
                onClick={() => onRevoke(g.granted_agent_id)}
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
