begin;

create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at
) values (
  '018f1495-9be7-7c36-a310-c0461a74f001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'owner@cluvvi.test',
  crypt('phase-zero-password', gen_salt('bf')),
  now(),
  now(),
  now()
), (
  '018f1495-9be7-7c36-a310-c0461a74f002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'outsider@cluvvi.test',
  crypt('phase-zero-password', gen_salt('bf')),
  now(),
  now(),
  now()
);

select set_config(
  'request.jwt.claims',
  json_build_object(
    'sub', '018f1495-9be7-7c36-a310-c0461a74f001',
    'role', 'authenticated'
  )::text,
  true
);
set local role authenticated;

insert into public.workspaces (id, name, owner_user_id)
values (
  '018f1495-9be7-7c36-a310-c0461a74f010',
  'Cluvvi test workspace',
  '018f1495-9be7-7c36-a310-c0461a74f001'
);

insert into public.missions (
  id,
  workspace_id,
  name,
  website_url,
  raw_description,
  customer_outcome,
  currency,
  geographies,
  desired_count,
  exclusions
) values (
  '018f1495-9be7-7c36-a310-c0461a74f020',
  '018f1495-9be7-7c36-a310-c0461a74f010',
  'Find video teams with editing pressure',
  'https://cluvvi.example',
  'An AI rough-cut editor for long-form talking-head video teams.',
  'Publish long-form videos faster with less manual editing labor.',
  'USD',
  array['United States'],
  20,
  array['Short-form-only creators']
);

create temporary table first_run as
select (public.start_mission_run(
  '018f1495-9be7-7c36-a310-c0461a74f020',
  20,
  25,
  'phase0-flow-key'
)).*;

select is((select status from first_run), 'draft', 'new run begins in draft');
select is((select count(*)::integer from public.run_events), 1, 'run_created is appended exactly once');

create temporary table repeated_run as
select (public.start_mission_run(
  '018f1495-9be7-7c36-a310-c0461a74f020',
  20,
  25,
  'phase0-flow-key'
)).*;

select is(
  (select id from first_run),
  (select id from repeated_run),
  'repeating run start returns the same run'
);
select is((select count(*)::integer from public.runs), 1, 'repeating run start creates no duplicate run');
select is((select count(*)::integer from public.run_events), 1, 'repeating run start creates no duplicate event');

reset role;
select set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
set local role service_role;

create temporary table lease as
select * from public.lease_mission_compile_messages(1, 60);

select is((select count(*)::integer from lease), 1, 'run start creates one durable queue message');

create temporary table processed as
select public.process_mission_compile_message(
  (select queue_message_id from lease),
  (select id from first_run),
  ((select message from lease)->>'messageId')::uuid,
  (select (message->>'idempotencyKey') from lease)
) as result;

select is((select status from public.runs limit 1), 'compiling', 'worker moves the run to compiling');
select is((select count(*)::integer from public.run_events), 2, 'worker appends one transition event');

select * from finish();
rollback;
