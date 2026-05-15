"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uuid";

async function verifyOwnsAgents(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
  ids: string[],
): Promise<boolean> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) {
    return false;
  }

  const { data, error } = await supabase
    .from("agents")
    .select("id")
    .eq("owner_user_id", ownerId)
    .in("id", unique);

  if (error || !data) {
    return false;
  }
  return data.length === unique.length;
}

export type MemoryAccessMutationResult =
  | { ok: true }
  | { ok: false; error: string };

export async function addMemoryReaderAction(
  sourceAgentId: string,
  grantedAgentId: string,
): Promise<MemoryAccessMutationResult> {
  const trimmed = grantedAgentId.trim();
  const src = sourceAgentId.trim();

  if (!isUuid(src) || !isUuid(trimmed)) {
    return { ok: false, error: "Agent id must be a valid UUID." };
  }
  if (src === trimmed) {
    return { ok: false, error: "An agent cannot grant read access to itself." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const ownsBoth = await verifyOwnsAgents(supabase, user.id, [src, trimmed]);
  if (!ownsBoth) {
    return {
      ok: false,
      error: "You must own both this agent and the reader agent.",
    };
  }

  const { error } = await supabase.from("memory_access").insert({
    source_agent_id: src,
    granted_agent_id: trimmed,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That reader already has access." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${src}`);
  return { ok: true };
}

export async function revokeMemoryReaderAction(
  sourceAgentId: string,
  grantedAgentId: string,
): Promise<MemoryAccessMutationResult> {
  const src = sourceAgentId.trim();
  const grt = grantedAgentId.trim();

  if (!isUuid(src) || !isUuid(grt)) {
    return { ok: false, error: "Invalid agent id." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return { ok: false, error: "You must be signed in." };
  }

  const { data, error } = await supabase
    .from("memory_access")
    .delete()
    .eq("source_agent_id", src)
    .eq("granted_agent_id", grt)
    .select("source_agent_id");

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return { ok: false, error: "No matching access rule to remove." };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/${src}`);
  return { ok: true };
}
