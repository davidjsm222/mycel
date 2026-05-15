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

function splitAgentKey(raw: string): { prefix: string; secret: string } {
  const key = raw.trim();
  const dot = key.indexOf(".");
  if (dot === -1 || dot === 0 || dot === key.length - 1) {
    throw new Error(
      'MYCEL_AGENT_KEY must be "<prefix>.<secret>" (when the agent API key was created).',
    );
  }
  return {
    prefix: key.slice(0, dot),
    secret: key.slice(dot + 1),
  };
}

async function resolveAgentIdFromEnv(
  supabase: ReturnType<typeof createServiceRoleClient>,
): Promise<string> {
  const raw = process.env.MYCEL_AGENT_KEY?.trim();
  if (!raw) {
    throw new Error(
      "MYCEL_AGENT_KEY is not set — add prefix.secret from mycel agent create to .env.",
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
      "MYCEL_AGENT_KEY did not match any active agent (check prefix/secret/revoked).",
    );
  }
  return String(data);
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

function publicMemoriesUrl(token: string): string {
  const raw =
    process.env.MYCEL_PUBLIC_API_BASE?.trim() || "http://127.0.0.1:3000";
  const base = raw.replace(/\/$/, "");
  const u = new URL("/memories/public", `${base}/`);
  u.searchParams.set("token", token);
  return u.toString();
}

async function tokenCreate(prefixRaw: string | undefined): Promise<void> {
  if (!prefixRaw?.trim()) {
    console.error("Usage: mycel token create <agent_prefix>");
    console.error("Example: mycel token create a1b2c3d4");
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

  const api_key_prefix = prefixRaw.trim();
  const supabase = createServiceRoleClient();

  const { data: agent, error: aErr } = await supabase
    .from("agents")
    .select("id, display_name")
    .eq("api_key_prefix", api_key_prefix)
    .eq("owner_user_id", ownerId)
    .is("revoked_at", null)
    .maybeSingle();

  if (aErr) {
    console.error("Agent lookup failed:", aErr.message);
    process.exit(1);
  }
  if (!agent) {
    console.error(
      "No active agent found for that prefix owned by MYCEL_OWNER_USER_ID.",
    );
    process.exit(1);
  }

  const { data: row, error: insErr } = await supabase
    .from("public_tokens")
    .insert({ agent_id: agent.id })
    .select("token")
    .single();

  if (insErr) {
    console.error("public_tokens insert failed:", insErr.message);
    process.exit(1);
  }
  if (!row?.token) {
    console.error("public_tokens insert returned no token");
    process.exit(1);
  }

  console.log("");
  console.log("Public read token created (read-only memory listing).");
  console.log("  agent_id:      ", agent.id);
  console.log("  display_name:  ", agent.display_name);
  console.log("");
  console.log("URL (share carefully — anyone with the link can read memories):");
  console.log(publicMemoriesUrl(row.token));
  console.log("");
}

async function tokenRevoke(tokenRaw: string | undefined): Promise<void> {
  if (!tokenRaw?.trim()) {
    console.error("Usage: mycel token revoke <token>");
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

  const token = tokenRaw.trim();
  const supabase = createServiceRoleClient();

  const { data: tokRow, error: tErr } = await supabase
    .from("public_tokens")
    .select("id, agent_id, revoked_at")
    .eq("token", token)
    .maybeSingle();

  if (tErr) {
    console.error("Token lookup failed:", tErr.message);
    process.exit(1);
  }
  if (!tokRow) {
    console.error("Unknown token.");
    process.exit(1);
  }
  if (tokRow.revoked_at) {
    console.log("Token was already revoked.");
    return;
  }

  const { data: agent, error: aErr } = await supabase
    .from("agents")
    .select("id")
    .eq("id", tokRow.agent_id)
    .eq("owner_user_id", ownerId)
    .is("revoked_at", null)
    .maybeSingle();

  if (aErr) {
    console.error("Agent lookup failed:", aErr.message);
    process.exit(1);
  }
  if (!agent) {
    console.error("You do not own the agent for this token.");
    process.exit(1);
  }

  const now = new Date().toISOString();
  const { error: uErr } = await supabase
    .from("public_tokens")
    .update({ revoked_at: now })
    .eq("id", tokRow.id)
    .is("revoked_at", null);

  if (uErr) {
    console.error("Revoke failed:", uErr.message);
    process.exit(1);
  }

  console.log("Token revoked.");
}

async function memoryWrite(contentPieces: string[]): Promise<void> {
  const body = contentPieces.join(" ").trim();
  if (!body) {
    console.error("Usage: mycel memory write <content>");
    console.error('Example: mycel memory write "picked up groceries"');
    process.exit(1);
  }

  loadMycelEnv();
  const supabase = createServiceRoleClient();

  let agentId: string;
  try {
    agentId = await resolveAgentIdFromEnv(supabase);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const { data: row, error } = await supabase
    .from("memories")
    .insert({
      agent_id: agentId,
      session_id: null,
      role: "note",
      content: body,
      facets: {},
      source: "user",
    })
    .select("id, created_at")
    .single();

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }

  console.log(
    `Saved memory ${row!.id} (${row!.created_at ?? ""})`,
  );
}

async function memoryList(): Promise<void> {
  loadMycelEnv();
  const supabase = createServiceRoleClient();

  let agentId: string;
  try {
    agentId = await resolveAgentIdFromEnv(supabase);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const { data: rows, error } = await supabase
    .from("memories")
    .select("content, created_at")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  if (!rows?.length) {
    console.log("(no memories yet)");
    return;
  }

  for (const r of rows) {
    const ts =
      typeof r.created_at === "string"
        ? r.created_at
        : String(r.created_at ?? "");
    console.log(`${ts}\t${r.content}`);
  }
}

function help(): void {
  console.log(`mycel
  doctor                 Load .env and verify DB (service role)

  agent create "<name>"  Create an agent, print API key once (needs MYCEL_OWNER_USER_ID)

  token create <prefix>  Create a read-only public URL for an agent (public_tokens)
  token revoke <token>   Revoke a public token (must own the agent)

  memory write <text>    Append a note (MYCEL_AGENT_KEY; source=user)
  memory list            Last 20 memories for MYCEL_AGENT_KEY agent

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

  if (cmd === "token") {
    const sub = argv[1];
    if (sub === "create") {
      await tokenCreate(argv[2]);
      return;
    }
    if (sub === "revoke") {
      await tokenRevoke(argv[2]);
      return;
    }
  }

  if (cmd === "memory") {
    const sub = argv[1];
    if (sub === "write") {
      await memoryWrite(argv.slice(2));
      return;
    }
    if (sub === "list") {
      await memoryList();
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
