import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { loadMycelEnv } from "./env.js";

export function getSupabaseUrl(): string {
  loadMycelEnv();
  const url = process.env.SUPABASE_URL?.trim();
  if (!url) {
    throw new Error("SUPABASE_URL is not set");
  }
  return url;
}

/** Browser / user-JWT style calls (dashboards, public clients). */
export function createAnonClient(): SupabaseClient {
  loadMycelEnv();
  const key = process.env.SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_ANON_KEY is not set");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Server-side MCP / CLI — full access; keep keys off clients. */
export function createServiceRoleClient(): SupabaseClient {
  loadMycelEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
