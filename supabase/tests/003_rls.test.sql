begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

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
  '018f1495-9be7-7c36-a310-c0461a74f101',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'owner2@cluvvi.test',
  crypt('phase-zero-password', gen_salt('bf')),
  now(),
  now(),
  now()
), (
  '018f1495-9be7-7c36-a310-c0461a74f102',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'outsider2@cluvvi.test',
  crypt('phase-zero-password', gen_salt('bf')),
  now(),
  now(),
  now()
);

select set_config('request.jwt.claims', json_build_object(
  'sub', '018f1495-9be7-7c36-a310-c0461a74f101',
  'role', 'authenticated'
)::text, true);
set local role authenticated;

insert into public.workspaces (id, name, owner_user_id)
values (
  '018f1495-9be7-7c36-a310-c0461a74f110',
  'Private tenant',
  '018f1495-9be7-7c36-a310-c0461a74f101'
);

insert into public.missions (
  workspace_id,
  name,
  website_url,
  raw_description,
  customer_outcome,
  geographies
) values (
  '018f1495-9be7-7c36-a310-c0461a74f110',
  'Private mission',
  'https://private.example',
  'A private product description that belongs to one workspace only.',
  'A private customer outcome that outsiders must never be able to read.',
  array['UAE']
);

select is((select count(*)::integer from public.workspaces), 1, 'owner can read own workspace');
select is((select count(*)::integer from public.missions), 1, 'owner can read own mission');

reset role;
select set_config('request.jwt.claims', json_build_object(
  'sub', '018f1495-9be7-7c36-a310-c0461a74f102',
  'role', 'authenticated'
)::text, true);
set local role authenticated;

select is((select count(*)::integer from public.workspaces), 0, 'outsider cannot read workspace');
select is((select count(*)::integer from public.missions), 0, 'outsider cannot read mission');

select * from finish();
rollback;
