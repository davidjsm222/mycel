-- Server-side bcrypt hash for agent API secrets (matches verify_agent_api_key / pgcrypto).
create extension if not exists pgcrypto with schema extensions;

create or replace function public.hash_agent_api_secret(p_plain text)
returns text
language sql
volatile
security definer
set search_path = public, extensions
as $$
  select crypt(p_plain, gen_salt('bf'));
$$;

comment on function public.hash_agent_api_secret(text) is
  'Returns crypt() bcrypt hash for agent api_key_hash; plain text never stored — call from trusted server only.';

revoke all on function public.hash_agent_api_secret(text) from public;
grant execute on function public.hash_agent_api_secret(text) to service_role;
revoke execute on function public.hash_agent_api_secret(text) from authenticated;
