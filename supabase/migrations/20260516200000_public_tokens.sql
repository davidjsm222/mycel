-- Read-only share links for public memory listing (credential is opaque token string).

create table public.public_tokens (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agents (id) on delete cascade,

  token text unique not null default (gen_random_uuid()::text),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.public_tokens is
  'Opaque token granting read-only listing of memories for agent_id via GET /memories/public.';
comment on column public.public_tokens.token is 'Secret segment in query string; revoke by setting revoked_at.';

create index public_tokens_agent_ix on public.public_tokens (agent_id);
create index public_tokens_active_token_ix on public.public_tokens (token)
  where revoked_at is null;

alter table public.public_tokens enable row level security;
