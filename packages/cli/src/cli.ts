#!/usr/bin/env node
import { randomBytes } from "node:crypto";

import { createServiceRoleClient, loadMycelEnv } from "@mycel/shared";

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "help";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

function randomPrefix(lengthBytes = 4): string {
  return randomBytes(lengthBytes).toString("hex");
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

async function doctor(): Promise<void> {
  loadMycelEnv();
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("agents").select("id").limit(1);
  if (error) {
    console.error("Supabase check failed:", error.message);
    if (
      error.message.includes("does not exist") ||
      error.message.includes("schema cache")
    ) {
      console.error(
        "Hint: open Supabase → SQL Editor and run supabase/migrations/*_initial_schema.sql",
      );
    }
    process.exit(1);
  }
  console.log("OK — connected to Supabase; public.agents is reachable.");
}

async function agentCreate(displayNameRaw: string | undefined): Promise<void> {
  if (!displayNameRaw?.trim()) {
    console.error('Usage: mycel agent create "<display-name>"');
    console.error(
      "Example: mycel agent create \"claude-code\"",
    );
    process.exit(1);
  }

  loadMycelEnv();

  const ownerId = process.env.MYCEL_OWNER_USER_ID?.trim();
  if (!ownerId || !isUuid(ownerId)) {
    console.error(
      "Set MYCEL_OWNER_USER_ID in .env to your Supabase Auth user UUID " +
        "(Dashboard → Authentication → Users → copy user id).",
    );
    process.exit(1);
  }

  const supabase = createServiceRoleClient();
  const display_name = displayNameRaw.trim();

  const maxAttempts = 8;
  let lastErr: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const api_key_prefix = randomPrefix();
    const secretPlain = randomSecret();

    const { data: api_key_hash, error: hashErr } = await supabase.rpc(
      "hash_agent_api_secret",
      { p_plain: secretPlain },
    );
    if (hashErr) {
      console.error("hash_agent_api_secret failed:", hashErr.message);
      console.error(
        "Hint: apply supabase/migrations/20260516100000_hash_agent_api_secret.sql",
      );
      process.exit(1);
    }
    if (typeof api_key_hash !== "string" || api_key_hash.length === 0) {
      console.error("hash_agent_api_secret returned empty hash");
      process.exit(1);
    }

    const { data: row, error: insErr } = await supabase
      .from("agents")
      .insert({
        owner_user_id: ownerId,
        display_name,
        api_key_prefix,
        api_key_hash,
        revoked_at: null,
        metadata: {},
      })
      .select("id, display_name")
      .single();

    if (!insErr && row) {
      const fullKey = `${api_key_prefix}.${secretPlain}`;
      console.log("");
      console.log("Agent created.");
      console.log("  id:           ", row.id);
      console.log("  display_name: ", row.display_name);
      console.log("");
      console.log("API key (copy now — raw secret will not be shown again):");
      console.log(fullKey);
      console.log("");
      console.log(
        "Save this immediately. Put it in MYCEL_AGENT_KEY for the MCP server (format is prefix.secret).",
      );
      return;
    }

    if (
      insErr?.message.includes("agents_api_key_prefix_active") ||
      insErr?.message.includes("duplicate key") ||
      insErr?.code === "23505"
    ) {
      lastErr = insErr.message;
      continue;
    }

    console.error("Insert failed:", insErr?.message ?? insErr);
    process.exit(1);
  }

  console.error(
    "Could not find a unique api_key_prefix after retries:",
    lastErr ?? "unknown",
  );
  process.exit(1);
}

function help(): void {
  console.log(`mycel
  doctor                 Load .env and verify DB (service role)

  agent create "<name>"  Create an agent, print API key once (needs MYCEL_OWNER_USER_ID)

  help                   This message`);
}

async function main(): Promise<void> {
  if (cmd === "doctor") {
    await doctor();
    return;
  }

  if (cmd === "agent") {
    const sub = argv[1];
    if (sub === "create") {
      await agentCreate(argv[2]);
      return;
    }
  }

  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    help();
    return;
  }

  console.error("Unknown command. Try: mycel help");
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
