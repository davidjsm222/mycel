-- Hosted Supabase often installs pgcrypto in schema "extensions". verify_agent_api_key used
-- SET search_path = public only, so unqualified crypt() failed. Include extensions on the path.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.verify_agent_api_key(p_prefix text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
begin
  if p_prefix is null or char_length(trim(p_prefix)) = 0 then
    return null;
  end if;
  if p_secret is null or length(p_secret) = 0 then
    return null;
  end if;

  select a.id into v_id
  from public.agents a
  where a.revoked_at is null
    and a.api_key_prefix = trim(p_prefix)
    and a.api_key_hash is not null
    and a.api_key_hash = crypt(p_secret, a.api_key_hash);

  return v_id;
end;
$$;

comment on function public.verify_agent_api_key(text, text) is
  'Returns agent UUID when prefix + secret match stored pgcrypto hash; else null. Server-side use.';

revoke all on function public.verify_agent_api_key(text, text) from public;
grant execute on function public.verify_agent_api_key(text, text) to service_role;
revoke execute on function public.verify_agent_api_key(text, text) from authenticated;
