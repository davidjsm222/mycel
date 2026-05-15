"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function randomPrefix(lengthBytes = 4): string {
  return randomBytes(lengthBytes).toString("hex");
}

function randomSecret(): string {
  return randomBytes(32).toString("base64url");
}

export type CreateAgentResult =
  | {
      ok: true;
      apiKey: string;
      agentId: string;
      displayName: string;
    }
  | { ok: false; error: string };

export async function signOutAction(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Creates an agent owned by the signed-in Supabase Auth user (same rules as CLI). */
export async function createAgentAction(): Promise<CreateAgentResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const display_name = "New agent";

  let lastDuplicate = false;
  const maxAttempts = 8;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const api_key_prefix = randomPrefix();
    const secretPlain = randomSecret();

    const { data: api_key_hash, error: hashErr } = await supabase.rpc(
      "hash_agent_api_secret",
      { p_plain: secretPlain },
    );
    if (hashErr) {
      return { ok: false, error: hashErr.message };
    }
    if (typeof api_key_hash !== "string" || api_key_hash.length === 0) {
      return { ok: false, error: "Could not hash API secret." };
    }

    const { data: row, error: insErr } = await supabase
      .from("agents")
      .insert({
        owner_user_id: user.id,
        display_name,
        api_key_prefix,
        api_key_hash,
        revoked_at: null,
        metadata: {},
      })
      .select("id")
      .single();

    if (!insErr && row?.id) {
      revalidatePath("/dashboard");
      revalidatePath(`/dashboard/${row.id}`);
      return {
        ok: true,
        apiKey: `${api_key_prefix}.${secretPlain}`,
        agentId: row.id,
        displayName: display_name,
      };
    }

    if (
      insErr?.code === "23505" ||
      insErr?.message.includes("agents_api_key_prefix_active") ||
      insErr?.message.includes("duplicate key")
    ) {
      lastDuplicate = true;
      continue;
    }

    return {
      ok: false,
      error: insErr?.message ?? "Could not create agent.",
    };
  }

  return {
    ok: false,
    error: lastDuplicate
      ? "Could not allocate a unique API key prefix. Try again."
      : "Could not create agent.",
  };
}

export async function updateAgentName(
  agentId: string,
  newName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const trimmed = newName.trim();
  if (!trimmed) {
    return { ok: false, error: "Name cannot be empty." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("agents")
    .update({ display_name: trimmed })
    .eq("id", agentId)
    .eq("owner_user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data) {
    return { ok: false, error: "Agent not found or access denied." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${agentId}`);
  return { ok: true };
}

/** Deletes agent if owned by the current user; on success redirects to /dashboard. */
export async function deleteAgent(
  agentId: string,
): Promise<{ ok: false; error: string } | undefined> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("owner_user_id", user.id)
    .select("id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "Agent not found or access denied." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
