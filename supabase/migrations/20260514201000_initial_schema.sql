-- Mycel v1 schema: agents, sessions, memories, memory_access (+ timestamp helper)
-- RLS protects rows for JWT-authenticated users (dashboard / direct REST as that user).
-- MCP + CLI programmatic access typically uses SUPABASE_SERVICE_ROLE_KEY and applies
-- API-key + permission checks in application logic (recommended for v1).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- agents
-- ---------------------------------------------------------------------------
create table public.agents (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,

  display_name text not null,
  description text,

  -- API key identification (never store the raw secret). Caller hashes with pgcrypto
  -- crypt(..., gen_salt('bf')) outside the DB; lookups use prefix equality first.
  api_key_prefix text,
  api_key_hash text,

  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agents_display_name_trimmed check (char_length(trim(display_name)) > 0),
  constraint agents_api_key_when_active check (
    revoked_at is not null
    or (api_key_prefix is not null and api_key_hash is not null)
  )
);

create unique index agents_api_key_prefix_active_uq
  on public.agents (api_key_prefix)
  where revoked_at is null and api_key_prefix is not null;

create index agents_owner_ix on public.agents (owner_user_id);

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,

  status text not null default 'active',

  summary text,
  client_info jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  ended_at timestamptz,

  constraint sessions_status_check check (status in ('active', 'ended'))
);

create index sessions_agent_started_ix on public.sessions (agent_id, started_at desc);

-- ---------------------------------------------------------------------------
-- memories
-- ---------------------------------------------------------------------------
create table public.memories (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,
  session_id uuid references public.sessions (id) on delete set null,

  role text default 'fact',
  content text not null,
  facets jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint memories_role_check check (role in ('fact', 'note', 'tool', 'misc')),
  constraint memories_content_trimmed check (char_length(trim(content)) > 0)
);

create index memories_agent_created_ix on public.memories (agent_id, created_at desc);
create index memories_session_ix on public.memories (session_id);

-- ---------------------------------------------------------------------------
-- memory_access: granted_agent_id may read memories for source_agent_id
-- ---------------------------------------------------------------------------
create table public.memory_access (
  id uuid primary key default gen_random_uuid(),
  source_agent_id uuid not null references public.agents (id) on delete cascade,
  granted_agent_id uuid not null references public.agents (id) on delete cascade,

  created_at timestamptz not null default now(),

  constraint memory_access_distinct_agents check (source_agent_id <> granted_agent_id),
  constraint memory_access_unique_grant unique (source_agent_id, granted_agent_id)
);

create index memory_access_grantee_ix on public.memory_access (granted_agent_id);
create index memory_access_source_ix on public.memory_access (source_agent_id);

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists agents_touch_updated_at on public.agents;
create trigger agents_touch_updated_at
  before update on public.agents
  for each row
  execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Ownership helpers for RLS
-- ---------------------------------------------------------------------------
create or replace function public.user_owns_agent(p_agent_id uuid, p_uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.agents a
    where a.id = p_agent_id and a.owner_user_id = p_uid
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security — authenticated users interacting as themselves
-- ---------------------------------------------------------------------------
alter table public.agents enable row level security;
alter table public.sessions enable row level security;
alter table public.memories enable row level security;
alter table public.memory_access enable row level security;

create policy agents_owner_rw
  on public.agents for all to authenticated
  using (owner_user_id = auth.uid())
  with check (owner_user_id = auth.uid());

create policy sessions_owner_rw
  on public.sessions for all to authenticated
  using (public.user_owns_agent(agent_id, auth.uid()))
  with check (public.user_owns_agent(agent_id, auth.uid()));

create policy memories_owner_rw
  on public.memories for all to authenticated
  using (public.user_owns_agent(agent_id, auth.uid()))
  with check (public.user_owns_agent(agent_id, auth.uid()));

-- Read-only delegation: accessor owners can SELECT memories keyed to the source agent
-- when memory_access grants that relationship (Supabase REST as authenticated user).
create policy memories_grantee_read_only
  on public.memories for select to authenticated
  using (
    exists (
      select 1
      from public.memory_access ma
      where ma.source_agent_id = memories.agent_id
        and public.user_owns_agent(ma.granted_agent_id, auth.uid())
    )
  );

-- Source agent owners create or drop grants they issue.
create policy memory_access_owner_insert
  on public.memory_access for insert to authenticated
  with check (public.user_owns_agent(source_agent_id, auth.uid()));

create policy memory_access_owner_select
  on public.memory_access for select to authenticated
  using (
    public.user_owns_agent(source_agent_id, auth.uid())
    or public.user_owns_agent(granted_agent_id, auth.uid())
  );

create policy memory_access_owner_delete
  on public.memory_access for delete to authenticated
  using (public.user_owns_agent(source_agent_id, auth.uid()));

-- Optionally allow recipients to relinquish grants (mirror delete); comment out if undesired:
create policy memory_access_grantee_delete
  on public.memory_access for delete to authenticated
  using (public.user_owns_agent(granted_agent_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- Comments (Postgres catalogue — useful when browsing Supabase dashboard)
-- ---------------------------------------------------------------------------
comment on table public.agents is 'LLM/agent identity scoped to one Supabase user; holds API-key material (hashed only).';
comment on table public.sessions is 'A working session binding activity to one agent.';
comment on table public.memories is 'Append-only knowledge log for agent_id (filter here for isolation).';
comment on table public.memory_access is 'source_agent permits granted_agent read access to memories where memories.agent_id = source_agent.';
