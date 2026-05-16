import { formatDateTime } from "./format";

export type AgentExportMeta = {
  id: string;
  display_name: string;
  api_key_prefix: string | null;
};

export type MemoryExportRow = {
  role: string | null;
  source: string | null;
  content: string;
  created_at: string | null;
};

/** Filename-safe ASCII fragment from display name. */
export function slugifyExportBasename(displayName: string): string {
  const s = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "agent";
}

function fencedBlock(lang: string, content: string): string[] {
  const body = content.replace(/\r\n/g, "\n");
  return [`~~~${lang}`, body, "~~~"];
}

/** Oldest-first entries; body in fenced blocks for safe paste into chats. */
export function buildMemoryMarkdownExport(
  agent: AgentExportMeta,
  memories: MemoryExportRow[],
  exportedIso: string,
): string {
  const lines: string[] = [];
  const title =
    agent.display_name.replace(/\r?\n/g, " ").trim() || "Untitled agent";

  lines.push(`# Mycel memory export · ${title}`);
  lines.push("");
  lines.push("## Metadata");
  lines.push("");
  lines.push(`- **Exported (UTC):** ${exportedIso}`);
  lines.push(`- **Agent:** ${agent.display_name}`);
  lines.push(`- **Agent ID:** \`${agent.id}\``);
  lines.push(
    `- **API key prefix:** \`${agent.api_key_prefix ?? "—"}\``,
  );
  lines.push(`- **Memory count:** ${memories.length}`);
  lines.push("");
  lines.push("Memories below are chronological (oldest first).");
  lines.push("");
  lines.push("---");
  lines.push("");

  memories.forEach((m, idx) => {
    const dt = formatDateTime(m.created_at);
    const role = (m.role ?? "note").trim();
    const source = (m.source ?? "unknown").trim();
    lines.push(`## ${idx + 1}. ${dt}`);
    lines.push("");
    lines.push(`- **Role:** ${role}`);
    lines.push(`- **Source:** ${source}`);
    lines.push("");
    lines.push(...fencedBlock("text", m.content));
    lines.push("");
    lines.push("---");
    lines.push("");
  });

  return lines.join("\n").trimEnd() + "\n";
}
