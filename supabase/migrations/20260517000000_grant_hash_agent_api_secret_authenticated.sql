-- Dashboard (browser session) creates agents via Supabase JWT + anon key; hashing must run under the authenticated role.
grant execute on function public.hash_agent_api_secret(text) to authenticated;
