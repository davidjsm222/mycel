-- Cross-agent memory access only between agents with the same Supabase Auth owner.

delete from public.memory_access ma
using public.agents src, public.agents grt
where ma.source_agent_id = src.id
  and ma.granted_agent_id = grt.id
  and src.owner_user_id <> grt.owner_user_id;

create or replace function public.memory_access_same_owner_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  src_owner uuid;
  grt_owner uuid;
begin
  select a.owner_user_id into src_owner
  from public.agents a
  where a.id = new.source_agent_id;

  select a.owner_user_id into grt_owner
  from public.agents a
  where a.id = new.granted_agent_id;

  if src_owner is null or grt_owner is null then
    raise exception 'memory_access: unknown source_agent_id or granted_agent_id';
  end if;

  if src_owner <> grt_owner then
    raise exception 'memory_access: source and granted agents must belong to the same owner';
  end if;

  return new;
end;
$$;

drop trigger if exists memory_access_same_owner_guard on public.memory_access;

create trigger memory_access_same_owner_guard
  before insert or update on public.memory_access
  for each row
  execute function public.memory_access_same_owner_guard();

drop policy if exists memory_access_owner_insert on public.memory_access;

create policy memory_access_owner_insert
  on public.memory_access for insert to authenticated
  with check (
    public.user_owns_agent(source_agent_id, auth.uid())
    and public.user_owns_agent(granted_agent_id, auth.uid())
  );

comment on function public.memory_access_same_owner_guard() is
  'Ensures memory_access rows only link agents that share owner_user_id.';
