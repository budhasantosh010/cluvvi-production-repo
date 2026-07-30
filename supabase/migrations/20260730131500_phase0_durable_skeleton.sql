begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pgmq with schema pgmq;

select pgmq.create('mission_compile');

create table public.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  settings_json jsonb not null default '{}'::jsonb check (jsonb_typeof(settings_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.missions (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 3 and 120),
  website_url text not null check (website_url ~* '^https?://'),
  raw_description text not null check (char_length(btrim(raw_description)) between 20 and 5000),
  customer_outcome text not null check (char_length(btrim(customer_outcome)) between 10 and 2000),
  price_min numeric(14, 2) check (price_min is null or price_min >= 0),
  price_max numeric(14, 2) check (price_max is null or price_max >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  geographies text[] not null check (cardinality(geographies) between 1 and 20),
  desired_count integer not null default 20 check (desired_count between 1 and 100),
  exclusions text[] not null default '{}'::text[] check (cardinality(exclusions) <= 50),
  capacity_notes text check (capacity_notes is null or char_length(capacity_notes) <= 2000),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint missions_price_range_valid check (
    price_min is null or price_max is null or price_min <= price_max
  )
);

create table public.runs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  status text not null default 'draft' check (status in (
    'draft',
    'compiling',
    'awaiting_interpretation_approval',
    'planning',
    'awaiting_plan_approval',
    'discovering',
    'normalizing',
    'investigating',
    'resolving_buyers',
    'enriching',
    'scoring',
    'reviewing',
    'completed',
    'paused',
    'cancelled',
    'budget_exhausted',
    'provider_blocked',
    'needs_user_input',
    'failed'
  )),
  phase text not null default 'queued' check (char_length(btrim(phase)) between 1 and 80),
  requested_count integer not null default 20 check (requested_count between 1 and 100),
  candidate_target integer not null default 300 check (candidate_target between 1 and 500),
  candidate_limit integer not null default 500 check (candidate_limit between candidate_target and 5000),
  investigation_limit integer not null default 80 check (investigation_limit between 1 and candidate_limit),
  enrichment_limit integer not null default 40 check (enrichment_limit between 0 and investigation_limit),
  budget_usd numeric(14, 4) not null check (budget_usd > 0),
  budget_search_calls integer not null default 100 check (budget_search_calls >= 0),
  budget_fetch_calls integer not null default 500 check (budget_fetch_calls >= 0),
  budget_model_tokens bigint not null default 1000000 check (budget_model_tokens >= 0),
  budget_enrichment_calls integer not null default 40 check (budget_enrichment_calls >= 0),
  actual_cost_usd numeric(14, 4) not null default 0 check (actual_cost_usd >= 0),
  actual_search_calls integer not null default 0 check (actual_search_calls >= 0),
  actual_fetch_calls integer not null default 0 check (actual_fetch_calls >= 0),
  actual_model_tokens bigint not null default 0 check (actual_model_tokens >= 0),
  actual_enrichment_calls integer not null default 0 check (actual_enrichment_calls >= 0),
  creation_idempotency_key text not null check (char_length(creation_idempotency_key) between 8 and 200),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  failure_code text,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mission_id, creation_idempotency_key)
);

create table public.run_events (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  event_type text not null check (event_type in (
    'run_created',
    'compilation_started',
    'interpretation_generated',
    'interpretation_approved',
    'source_plan_generated',
    'source_plan_approved',
    'search_started',
    'search_completed',
    'candidate_created',
    'candidate_rejected',
    'investigation_started',
    'investigation_completed',
    'buyer_resolved',
    'contact_enriched',
    'opportunity_scored',
    'review_failed',
    'run_paused',
    'run_resumed',
    'budget_exhausted',
    'run_cancelled',
    'run_completed',
    'run_failed'
  )),
  from_status text check (from_status is null or from_status in (
    'draft', 'compiling', 'awaiting_interpretation_approval', 'planning',
    'awaiting_plan_approval', 'discovering', 'normalizing', 'investigating',
    'resolving_buyers', 'enriching', 'scoring', 'reviewing', 'completed',
    'paused', 'cancelled', 'budget_exhausted', 'provider_blocked',
    'needs_user_input', 'failed'
  )),
  to_status text not null check (to_status in (
    'draft', 'compiling', 'awaiting_interpretation_approval', 'planning',
    'awaiting_plan_approval', 'discovering', 'normalizing', 'investigating',
    'resolving_buyers', 'enriching', 'scoring', 'reviewing', 'completed',
    'paused', 'cancelled', 'budget_exhausted', 'provider_blocked',
    'needs_user_input', 'failed'
  )),
  actor_type text not null check (actor_type in ('user', 'worker', 'system')),
  actor_id uuid references auth.users(id) on delete set null,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  unique (run_id, idempotency_key)
);

create index workspaces_owner_user_id_idx on public.workspaces(owner_user_id);
create index workspace_memberships_user_id_idx on public.workspace_memberships(user_id, workspace_id);
create index missions_workspace_created_idx on public.missions(workspace_id, created_at desc);
create index runs_workspace_created_idx on public.runs(workspace_id, created_at desc);
create index runs_mission_created_idx on public.runs(mission_id, created_at desc);
create index runs_status_idx on public.runs(status) where status not in ('completed', 'cancelled', 'failed');
create index run_events_run_created_idx on public.run_events(run_id, created_at, id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger missions_set_updated_at
before update on public.missions
for each row execute function public.set_updated_at();

create trigger runs_set_updated_at
before update on public.runs
for each row execute function public.set_updated_at();

create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = p_user_id
  );
$$;

create or replace function public.has_workspace_role(
  p_workspace_id uuid,
  p_roles text[],
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.workspace_memberships membership
    where membership.workspace_id = p_workspace_id
      and membership.user_id = p_user_id
      and membership.role = any(p_roles)
  );
$$;

create or replace function public.add_workspace_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.workspace_memberships(workspace_id, user_id, role)
  values (new.id, new.owner_user_id, 'owner')
  on conflict (workspace_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

create trigger workspaces_add_owner_membership
after insert on public.workspaces
for each row execute function public.add_workspace_owner_membership();

alter table public.workspaces enable row level security;
alter table public.workspace_memberships enable row level security;
alter table public.missions enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;

create policy workspaces_select_member
on public.workspaces for select
to authenticated
using (public.is_workspace_member(id));

create policy workspaces_insert_self_owned
on public.workspaces for insert
to authenticated
with check (owner_user_id = auth.uid());

create policy workspaces_update_admin
on public.workspaces for update
to authenticated
using (public.has_workspace_role(id, array['owner', 'admin']))
with check (public.has_workspace_role(id, array['owner', 'admin']));

create policy workspaces_delete_owner
on public.workspaces for delete
to authenticated
using (public.has_workspace_role(id, array['owner']));

create policy memberships_select_member
on public.workspace_memberships for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy missions_select_member
on public.missions for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy missions_insert_member
on public.missions for insert
to authenticated
with check (public.is_workspace_member(workspace_id));

create policy missions_update_member
on public.missions for update
to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy missions_delete_admin
on public.missions for delete
to authenticated
using (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy runs_select_member
on public.runs for select
to authenticated
using (public.is_workspace_member(workspace_id));

create policy run_events_select_member
on public.run_events for select
to authenticated
using (public.is_workspace_member(workspace_id));

create or replace function public.start_mission_run(
  p_mission_id uuid,
  p_requested_count integer,
  p_budget_usd numeric,
  p_idempotency_key text
)
returns public.runs
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_mission public.missions%rowtype;
  v_run public.runs%rowtype;
  v_message_id uuid := extensions.gen_random_uuid();
  v_now timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_requested_count < 1 or p_requested_count > 100 then
    raise exception 'requested_count must be between 1 and 100' using errcode = '22023';
  end if;

  if p_budget_usd <= 0 or p_budget_usd > 100000 then
    raise exception 'budget_usd is outside the supported range' using errcode = '22023';
  end if;

  if char_length(btrim(p_idempotency_key)) < 8 then
    raise exception 'idempotency key is too short' using errcode = '22023';
  end if;

  select * into v_mission
  from public.missions
  where id = p_mission_id;

  if not found or not public.is_workspace_member(v_mission.workspace_id, v_user_id) then
    raise exception 'Mission not found' using errcode = 'P0002';
  end if;

  select * into v_run
  from public.runs
  where mission_id = p_mission_id
    and creation_idempotency_key = p_idempotency_key;

  if found then
    return v_run;
  end if;

  insert into public.runs (
    workspace_id,
    mission_id,
    status,
    phase,
    requested_count,
    budget_usd,
    creation_idempotency_key
  ) values (
    v_mission.workspace_id,
    v_mission.id,
    'draft',
    'queued',
    p_requested_count,
    p_budget_usd,
    p_idempotency_key
  )
  returning * into v_run;

  insert into public.run_events (
    workspace_id,
    run_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    idempotency_key,
    metadata_json
  ) values (
    v_run.workspace_id,
    v_run.id,
    'run_created',
    null,
    'draft',
    'user',
    v_user_id,
    'run-created:' || p_idempotency_key,
    jsonb_build_object('requestedCount', p_requested_count, 'budgetUsd', p_budget_usd)
  );

  perform pgmq.send(
    'mission_compile',
    jsonb_build_object(
      'version', 1,
      'messageId', v_message_id,
      'jobType', 'mission_compile',
      'runId', v_run.id,
      'entityId', null,
      'attempt', 1,
      'idempotencyKey', 'compile:' || v_run.id,
      'createdAt', to_jsonb(v_now),
      'payload', '{}'::jsonb
    )
  );

  return v_run;
exception
  when unique_violation then
    select * into v_run
    from public.runs
    where mission_id = p_mission_id
      and creation_idempotency_key = p_idempotency_key;
    return v_run;
end;
$$;

create or replace function public.lease_mission_compile_messages(
  p_quantity integer default 1,
  p_visibility_timeout_seconds integer default 60
)
returns table (
  queue_message_id bigint,
  read_count integer,
  enqueued_at timestamptz,
  visibility_deadline timestamptz,
  message jsonb
)
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  if p_quantity < 1 or p_quantity > 25 then
    raise exception 'quantity must be between 1 and 25' using errcode = '22023';
  end if;

  if p_visibility_timeout_seconds < 10 or p_visibility_timeout_seconds > 3600 then
    raise exception 'visibility timeout must be between 10 and 3600 seconds' using errcode = '22023';
  end if;

  return query
  select
    queued.msg_id,
    queued.read_ct,
    queued.enqueued_at,
    queued.vt,
    queued.message
  from pgmq.read('mission_compile', p_visibility_timeout_seconds, p_quantity) queued;
end;
$$;

create or replace function public.process_mission_compile_message(
  p_queue_message_id bigint,
  p_run_id uuid,
  p_message_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pgmq
as $$
declare
  v_run public.runs%rowtype;
  v_duplicate boolean;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;

  select * into v_run
  from public.runs
  where id = p_run_id
  for update;

  if not found then
    perform pgmq.delete('mission_compile', p_queue_message_id);
    return jsonb_build_object('outcome', 'missing_run', 'run_id', p_run_id, 'status', null);
  end if;

  select exists (
    select 1
    from public.run_events event
    where event.run_id = p_run_id
      and event.idempotency_key = p_idempotency_key
  ) into v_duplicate;

  if v_duplicate then
    perform pgmq.delete('mission_compile', p_queue_message_id);
    return jsonb_build_object('outcome', 'duplicate', 'run_id', p_run_id, 'status', v_run.status);
  end if;

  if v_run.status <> 'draft' then
    perform pgmq.delete('mission_compile', p_queue_message_id);
    return jsonb_build_object('outcome', 'invalid_state', 'run_id', p_run_id, 'status', v_run.status);
  end if;

  update public.runs
  set
    status = 'compiling',
    phase = 'compiling',
    started_at = coalesce(started_at, now())
  where id = p_run_id
  returning * into v_run;

  insert into public.run_events (
    workspace_id,
    run_id,
    event_type,
    from_status,
    to_status,
    actor_type,
    actor_id,
    idempotency_key,
    metadata_json
  ) values (
    v_run.workspace_id,
    v_run.id,
    'compilation_started',
    'draft',
    'compiling',
    'worker',
    null,
    p_idempotency_key,
    jsonb_build_object('messageId', p_message_id)
  );

  perform pgmq.delete('mission_compile', p_queue_message_id);

  return jsonb_build_object('outcome', 'processed', 'run_id', p_run_id, 'status', v_run.status);
end;
$$;

revoke all on function public.is_workspace_member(uuid, uuid) from public;
revoke all on function public.has_workspace_role(uuid, text[], uuid) from public;
revoke all on function public.start_mission_run(uuid, integer, numeric, text) from public;
revoke all on function public.lease_mission_compile_messages(integer, integer) from public;
revoke all on function public.process_mission_compile_message(bigint, uuid, uuid, text) from public;

grant execute on function public.is_workspace_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.has_workspace_role(uuid, text[], uuid) to authenticated, service_role;
grant execute on function public.start_mission_run(uuid, integer, numeric, text) to authenticated;
grant execute on function public.lease_mission_compile_messages(integer, integer) to service_role;
grant execute on function public.process_mission_compile_message(bigint, uuid, uuid, text) to service_role;

grant select, insert, update, delete on public.workspaces to authenticated;
grant select on public.workspace_memberships to authenticated;
grant select, insert, update, delete on public.missions to authenticated;
grant select on public.runs to authenticated;
grant select on public.run_events to authenticated;

grant all on public.workspaces, public.workspace_memberships, public.missions, public.runs, public.run_events to service_role;

commit;
