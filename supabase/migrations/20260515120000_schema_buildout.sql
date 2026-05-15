-- Mycel schema build-out: session hygiene, append-only memories for JWT users,
-- API-key verification RPC (for MCP/CLI calling Postgres over the REST/RPC layer).

-- ---------------------------------------------------------------------------
-- Sessions: lifecycle consistency + updated_at
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column if not exists updated_at timestamptz not null default now();

-- Normalize rows before enforcing strict active/ended rules.
update public.sessions
set ended_at = now()
where status = 'ended' and ended_at is null;

update public.sessions
set ended_at = null
where status = 'active' and ended_at is not null;

alter table public.sessions
  drop constraint if exists sessions_status_ended_at;

alter table public.sessions
  add constraint sessions_status_ended_at check (
    (status = 'active' and ended_at is null)
    or (status = 'ended' and ended_at is not null)
  );

drop trigger if exists sessions_touch_updated_at on public.sessions;

create trigger sessions_touch_updated_at
  before update on public.sessions
  for each row
  execute function public.touch_updated_at();

create index if not exists sessions_status_ix
  on public.sessions (agent_id, status)
  where status = 'active';

comment on column public.sessions.updated_at is 'Row last touched; distinct from ended_at (semantic close).';

-- ---------------------------------------------------------------------------
-- Memories: provenance + append-only for authenticated REST (service_role unchanged)
-- ---------------------------------------------------------------------------
alter table public.memories
  add column if not exists source text not null default 'agent';

alter table public.memories
  drop constraint if exists memories_source_check;

alter table public.memories
  add constraint memories_source_check check (source in ('user', 'agent', 'system', 'import'));

comment on column public.memories.source is 'Who produced the row: user / agent / system / bulk import.';

-- Replace broad owner ALL policy with insert/select/delete (no update = append-only for owners).
drop policy if exists memories_owner_rw on public.memories;

create policy memories_owner_insert
  on public.memories for insert to authenticated
  with check (public.user_owns_agent(agent_id, auth.uid()));

create policy memories_owner_select
  on public.memories for select to authenticated
  using (public.user_owns_agent(agent_id, auth.uid()));

create policy memories_owner_delete
  on public.memories for delete to authenticated
  using (public.user_owns_agent(agent_id, auth.uid()));

-- Grantee read path unchanged (see previous migration). No UPDATE policy: JWT clients cannot edit rows.

comment on policy memories_grantee_read_only on public.memories is
  'Delegated readers (owners of granted_agent_id) may SELECT source agent memory rows.';

-- ---------------------------------------------------------------------------
-- memory_access: optional note for audit / UI
-- ---------------------------------------------------------------------------
alter table public.memory_access
  add column if not exists note text;

comment on column public.memory_access.note is 'Optional human-readable reason or label for the grant.';

-- ---------------------------------------------------------------------------
-- RPC: verify API key material and return agent id (SECURITY DEFINER)
-- Call from trusted server code via PostgREST; not granted to anon.
-- ---------------------------------------------------------------------------
create or replace function public.verify_agent_api_key(p_prefix text, p_secret text)
returns uuid
language plpgsql
security definer
set search_path = public
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

-- Authenticated dashboard tools could call this with extreme care; keep off by default.
revoke execute on function public.verify_agent_api_key(text, text) from authenticated;

-- ---------------------------------------------------------------------------
-- RPC: compact grant check for server-side permission gates
-- ---------------------------------------------------------------------------
create or replace function public.can_read_agent_memories(p_reader uuid, p_memory_owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_reader = p_memory_owner
    or exists (
      select 1
      from public.memory_access ma
      where ma.source_agent_id = p_memory_owner
        and ma.granted_agent_id = p_reader
    );
$$;

comment on function public.can_read_agent_memories(uuid, uuid) is
  'True if reader is the memory owner agent or has an active memory_access grant.';

revoke all on function public.can_read_agent_memories(uuid, uuid) from public;
grant execute on function public.can_read_agent_memories(uuid, uuid) to service_role;
revoke execute on function public.can_read_agent_memories(uuid, uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- Helpful listing index for “my agents” dashboards
-- ---------------------------------------------------------------------------
create index if not exists agents_owner_created_ix
  on public.agents (owner_user_id, created_at desc);
