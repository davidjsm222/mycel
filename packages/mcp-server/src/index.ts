import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServiceRoleClient, loadMycelEnv } from "@mycel/shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { registerMemoryTools } from "./tools/memory.js";

loadMycelEnv();

function splitAgentKey(raw: string): { prefix: string; secret: string } {
  const key = raw.trim();
  const dot = key.indexOf(".");
  if (dot === -1 || dot === 0 || dot === key.length - 1) {
    throw new Error(
      'MYCEL_AGENT_KEY must be "<prefix>.<secret>" (values from when the agent API key was created).',
    );
  }
  return {
    prefix: key.slice(0, dot),
    secret: key.slice(dot + 1),
  };
}

let cachedAgentId: string | null = null;

async function resolveCallerAgentId(
  supabase: SupabaseClient,
): Promise<string> {
  if (cachedAgentId) {
    return cachedAgentId;
  }
  const raw = process.env.MYCEL_AGENT_KEY?.trim();
  if (!raw) {
    throw new Error(
      "MYCEL_AGENT_KEY is not set — add it to .env (format: prefix.secret, matching your agent row).",
    );
  }
  const { prefix, secret } = splitAgentKey(raw);
  const { data, error } = await supabase.rpc("verify_agent_api_key", {
    p_prefix: prefix,
    p_secret: secret,
  });
  if (error) {
    throw new Error(error.message);
  }
  if (data == null) {
    throw new Error(
      "MYCEL_AGENT_KEY did not match any active agent (check prefix, secret, and revoked_at).",
    );
  }
  const id = String(data);
  cachedAgentId = id;
  return id;
}

async function main(): Promise<void> {
  const supabase = createServiceRoleClient();

  const server = new McpServer(
    { name: "mycel", version: "0.1.0" },
    {
      instructions:
        "Mycel memory tools. The caller agent is fixed by MYCEL_AGENT_KEY in the server environment. " +
        "Use read_memory to fetch memories (optionally another agent if a grant exists). " +
        "Use write_memory to append a memory for your agent.",
    },
  );

  registerMemoryTools(server, supabase, () => resolveCallerAgentId(supabase));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(msg);
  process.exit(1);
});
