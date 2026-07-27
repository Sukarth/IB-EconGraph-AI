-- ============================================================================
-- IB EconGraph AI — Supabase schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh
-- project. Safe to re-run: statements are idempotent where possible.
--
-- Tables:
--   profiles        — one row per user; billing/entitlement state (Polar)
--   projects        — synced project folders
--   graphs          — synced graphs (full Graph JSON in `data`)
--   graph_versions  — version history snapshots (pruned client-side)
--   shares          — public view-only share links (unguessable slug ids)
--   templates       — user's custom component templates
--   ai_usage        — hosted AI generation counters, one row per user/month
--
-- Entitlement model:
--   The Polar webhook (server, service role) writes pro_status / pro_until.
--   A user is "Pro" while pro_until > now(). Write access to synced data is
--   gated on is_pro(); read access is owner-only but NOT pro-gated, so users
--   whose subscription lapsed can always retrieve their data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  email                 text,
  display_name          text,
  -- Supporter recognition (opt-in name listed in the README)
  supporter_name        text,
  show_in_supporters    boolean not null default false,
  -- Billing state, written only by the Polar webhook via service role
  pro_status            text not null default 'none',
  pro_until             timestamptz,
  plan_interval         text,
  polar_customer_id     text,
  polar_subscription_id text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Create a profile row automatically for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-only. It must stay SECURITY DEFINER (it inserts the profile row before
-- any user session exists), but it should never be callable via the REST API —
-- revoke EXECUTE so it isn't exposed as an RPC (DB linter 0028/0029).
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Entitlement check used by RLS policies below. SECURITY INVOKER (runs as the
-- caller): every policy calls it as is_pro(auth.uid()), so under the profiles
-- SELECT policy it can only ever read the caller's own row. Kept out of
-- SECURITY DEFINER on purpose — a definer function exposed via PostgREST is
-- what the DB linter (0028/0029) flags, and it isn't needed here.
create or replace function public.is_pro(p_user uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user
      and pro_until is not null
      and pro_until > now()
  );
$$;

revoke execute on function public.is_pro(uuid) from public;
grant execute on function public.is_pro(uuid) to authenticated;

drop policy if exists "profiles: select own" on public.profiles;
create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Users may only edit their harmless profile columns; billing columns are
-- writable exclusively via the service role (column-level privileges).
revoke update on public.profiles from authenticated;
grant update (display_name, supporter_name, show_in_supporters)
  on public.profiles to authenticated;

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table if not exists public.projects (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default '',
  description   text not null default '',
  color         text not null default '#3b82f6',
  created_at_ms bigint not null default 0,
  last_modified bigint not null default 0,
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

create index if not exists projects_user_idx on public.projects (user_id);

alter table public.projects enable row level security;

drop policy if exists "projects: select own" on public.projects;
create policy "projects: select own"
  on public.projects for select
  using (auth.uid() = user_id);

drop policy if exists "projects: insert own (pro)" on public.projects;
create policy "projects: insert own (pro)"
  on public.projects for insert
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "projects: update own (pro)" on public.projects;
create policy "projects: update own (pro)"
  on public.projects for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "projects: delete own" on public.projects;
create policy "projects: delete own"
  on public.projects for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- graphs
-- ----------------------------------------------------------------------------
create table if not exists public.graphs (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  project_id    uuid,
  title         text not null default '',
  data          jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null default 0,
  last_modified bigint not null default 0,
  deleted       boolean not null default false,
  updated_at    timestamptz not null default now()
);

create index if not exists graphs_user_idx on public.graphs (user_id);

alter table public.graphs enable row level security;

drop policy if exists "graphs: select own" on public.graphs;
create policy "graphs: select own"
  on public.graphs for select
  using (auth.uid() = user_id);

drop policy if exists "graphs: insert own (pro)" on public.graphs;
create policy "graphs: insert own (pro)"
  on public.graphs for insert
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "graphs: update own (pro)" on public.graphs;
create policy "graphs: update own (pro)"
  on public.graphs for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "graphs: delete own" on public.graphs;
create policy "graphs: delete own"
  on public.graphs for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- graph_versions — snapshots written on every synced change, pruned to the
-- most recent N per graph by the client via prune_graph_versions().
-- ----------------------------------------------------------------------------
create table if not exists public.graph_versions (
  id            uuid primary key default gen_random_uuid(),
  graph_id      uuid not null,
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null default '',
  data          jsonb not null default '{}'::jsonb,
  last_modified bigint not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists graph_versions_graph_idx
  on public.graph_versions (graph_id, created_at desc);

alter table public.graph_versions enable row level security;

drop policy if exists "graph_versions: select own" on public.graph_versions;
create policy "graph_versions: select own"
  on public.graph_versions for select
  using (auth.uid() = user_id);

drop policy if exists "graph_versions: insert own (pro)" on public.graph_versions;
create policy "graph_versions: insert own (pro)"
  on public.graph_versions for insert
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "graph_versions: delete own" on public.graph_versions;
create policy "graph_versions: delete own"
  on public.graph_versions for delete
  using (auth.uid() = user_id);

-- Hard ceiling on stored versions per graph, enforced by the database itself.
-- The client asks for 30 (VERSIONS_TO_KEEP), but p_keep below is caller-supplied
-- and a tampered client could pass a huge value, or simply never call prune at
-- all, and grow this table without bound. The insert trigger further down makes
-- the cap unavoidable, so neither trick works.
create or replace function public.graph_version_cap()
returns integer
language sql
immutable
as $$ select 100 $$;

create or replace function public.prune_graph_versions(p_graph uuid, p_keep integer default 30)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.graph_versions
  where graph_id = p_graph
    and user_id = auth.uid()
    and id not in (
      select id from public.graph_versions
      where graph_id = p_graph and user_id = auth.uid()
      order by created_at desc
      -- Clamped to [1, cap]: a caller cannot request an unbounded keep count.
      limit least(greatest(p_keep, 1), public.graph_version_cap())
    );
$$;

grant execute on function public.prune_graph_versions(uuid, integer) to authenticated;

-- Enforce the cap on every insert, so retention never depends on the client
-- choosing to call prune_graph_versions(). SECURITY DEFINER because it must
-- delete rows during the caller's insert; it only ever touches the same
-- (graph_id, user_id) pair that was just inserted, so it cannot reach another
-- user's data. Trigger-only, so EXECUTE is revoked (DB linter 0028/0029).
create or replace function public.enforce_graph_version_cap()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.graph_versions
  where graph_id = new.graph_id
    and user_id = new.user_id
    and id not in (
      select id from public.graph_versions
      where graph_id = new.graph_id and user_id = new.user_id
      order by created_at desc
      limit public.graph_version_cap()
    );
  return null;
end;
$$;

revoke execute on function public.enforce_graph_version_cap() from public, anon, authenticated;

drop trigger if exists graph_versions_enforce_cap on public.graph_versions;
create trigger graph_versions_enforce_cap
  after insert on public.graph_versions
  for each row execute function public.enforce_graph_version_cap();

-- Deleting a graph must take its history with it. Deletion is a soft delete
-- (a tombstone row with deleted = true, so other devices learn about it), and
-- graph_versions has no FK to graphs, so nothing would otherwise ever remove
-- these rows: they would sit in the table until the whole account is deleted.
-- Doing it in the database means it also covers deletes from an older client.
create or replace function public.purge_versions_for_deleted_graph()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted and not coalesce(old.deleted, false) then
    delete from public.graph_versions
    where graph_id = new.id and user_id = new.user_id;
  end if;
  return null;
end;
$$;

revoke execute on function public.purge_versions_for_deleted_graph() from public, anon, authenticated;

drop trigger if exists graphs_purge_versions_on_delete on public.graphs;
create trigger graphs_purge_versions_on_delete
  after insert or update of deleted on public.graphs
  for each row execute function public.purge_versions_for_deleted_graph();

-- ----------------------------------------------------------------------------
-- shares — view-only snapshots addressed by an unguessable slug.
-- Payloads contain diagram data only (never chat history).
--
-- Anonymous access is served ONLY through the get_share() RPC below, which
-- returns just the payload for an exact slug match. The table itself is NOT
-- readable by anon: a blanket `using (true)` SELECT policy would let anyone
-- holding the public publishable key (which authenticates as the `anon` role)
-- bulk-enumerate every share's payload and owner user_id via PostgREST,
-- defeating the point of unguessable slugs.
-- ----------------------------------------------------------------------------
create table if not exists public.shares (
  id         text primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('graph', 'project')),
  graph_id   uuid,
  project_id uuid,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shares_user_idx on public.shares (user_id);
create index if not exists shares_graph_idx on public.shares (graph_id);
create index if not exists shares_project_idx on public.shares (project_id);

alter table public.shares enable row level security;

-- Owners can read their own share rows (needed for getShareIdFor* / refresh).
-- Public read goes through get_share() instead of a table policy.
drop policy if exists "shares: public read" on public.shares;
drop policy if exists "shares: select own" on public.shares;
create policy "shares: select own"
  on public.shares for select
  using (auth.uid() = user_id);

revoke select on public.shares from anon;

-- Anonymous slug lookup: returns only the payload, only for an exact id match.
-- No enumeration (must know the 96-bit slug), no user_id / graph_id leakage.
-- NOTE: The DB linter (0028/0029) flags this as an anon-executable SECURITY
-- DEFINER function. That is INTENTIONAL and required: anonymous visitors must
-- resolve a share link without a session, and it must bypass the shares RLS
-- (which is otherwise owner-only). It's safe because it takes an exact,
-- unguessable id and returns nothing but that row's payload. Leave as-is.
create or replace function public.get_share(p_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select payload from public.shares where id = p_id;
$$;

revoke execute on function public.get_share(text) from public;
grant execute on function public.get_share(text) to anon, authenticated;

drop policy if exists "shares: insert own (pro)" on public.shares;
create policy "shares: insert own (pro)"
  on public.shares for insert
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "shares: update own (pro)" on public.shares;
create policy "shares: update own (pro)"
  on public.shares for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "shares: delete own" on public.shares;
create policy "shares: delete own"
  on public.shares for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- templates — user's custom component templates (synced)
-- ----------------------------------------------------------------------------
create table if not exists public.templates (
  id            uuid primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null default '',
  description   text not null default '',
  category      text not null default 'custom',
  data          jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  last_modified bigint not null default 0
);

create index if not exists templates_user_idx on public.templates (user_id);

alter table public.templates enable row level security;

drop policy if exists "templates: select own" on public.templates;
create policy "templates: select own"
  on public.templates for select
  using (auth.uid() = user_id);

drop policy if exists "templates: insert own (pro)" on public.templates;
create policy "templates: insert own (pro)"
  on public.templates for insert
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "templates: update own (pro)" on public.templates;
create policy "templates: update own (pro)"
  on public.templates for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and public.is_pro(auth.uid()));

drop policy if exists "templates: delete own" on public.templates;
create policy "templates: delete own"
  on public.templates for delete
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- ai_usage — hosted AI metering. Written only by the server (service role)
-- through the atomic functions below. Users can read their own row.
-- ----------------------------------------------------------------------------
create table if not exists public.ai_usage (
  user_id    uuid not null references auth.users (id) on delete cascade,
  month      text not null, -- 'YYYY-MM' (UTC)
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage: select own" on public.ai_usage;
create policy "ai_usage: select own"
  on public.ai_usage for select
  using (auth.uid() = user_id);

-- Atomically increment usage if under the limit. Returns the new count, or
-- -1 when the limit has been reached (row unchanged).
create or replace function public.increment_ai_usage(p_user uuid, p_month text, p_limit integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count integer;
begin
  insert into public.ai_usage (user_id, month, count)
  values (p_user, p_month, 1)
  on conflict (user_id, month) do update
    set count = ai_usage.count + 1,
        updated_at = now()
    where ai_usage.count < p_limit
  returning count into new_count;

  if new_count is null then
    return -1;
  end if;
  return new_count;
end;
$$;

-- Refund one generation (used when the upstream AI call fails after metering).
create or replace function public.refund_ai_usage(p_user uuid, p_month text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_usage
  set count = greatest(count - 1, 0),
      updated_at = now()
  where user_id = p_user and month = p_month;
$$;

-- These are only ever called with the service role key.
revoke execute on function public.increment_ai_usage(uuid, text, integer) from public, anon, authenticated;
revoke execute on function public.refund_ai_usage(uuid, text) from public, anon, authenticated;
