begin;

create extension if not exists pgtap with schema extensions;

select plan(16);

select has_table('public', 'workspaces', 'workspaces table exists');
select has_table('public', 'workspace_memberships', 'workspace memberships table exists');
select has_table('public', 'missions', 'missions table exists');
select has_table('public', 'runs', 'runs table exists');
select has_table('public', 'run_events', 'run events table exists');

select has_index('public', 'runs', 'runs_mission_id_creation_idempotency_key_key', 'run creation is idempotent');
select has_index('public', 'run_events', 'run_events_run_id_idempotency_key_key', 'run events are idempotent');

select policies_are(
  'public',
  'workspaces',
  array[
    'workspaces_delete_owner',
    'workspaces_insert_self_owned',
    'workspaces_select_member',
    'workspaces_update_admin'
  ],
  'workspaces has explicit tenant policies'
);

select policies_are(
  'public',
  'missions',
  array[
    'missions_delete_admin',
    'missions_insert_member',
    'missions_select_member',
    'missions_update_member'
  ],
  'missions has explicit tenant policies'
);

select policies_are(
  'public',
  'runs',
  array['runs_select_member'],
  'clients can only read authorized runs'
);

select policies_are(
  'public',
  'run_events',
  array['run_events_select_member'],
  'clients can only read authorized events'
);

select function_returns(
  'public',
  'start_mission_run',
  array['uuid', 'integer', 'numeric', 'text'],
  'public.runs',
  'start_mission_run returns a run'
);

select function_returns(
  'public',
  'process_mission_compile_message',
  array['bigint', 'uuid', 'uuid', 'text'],
  'jsonb',
  'worker processing returns a structured result'
);

select col_is_pk('public', 'workspace_memberships', array['workspace_id', 'user_id'], 'membership identity is unique');
select col_not_null('public', 'runs', 'workspace_id', 'run workspace scope is mandatory');
select col_not_null('public', 'run_events', 'idempotency_key', 'event idempotency is mandatory');

select * from finish();
rollback;
