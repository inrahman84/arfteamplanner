-- Minimal *Planner-side* compatibility fixture for an ephemeral local Supabase DB.
-- Supabase CLI owns auth.users/auth.uid(); do NOT substitute production credentials.
-- These tables model the existing Planner objects referenced by migration 019.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 email text not null default '',
 username text,
 job_title text not null default '',
 avatar_url text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.workspaces (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 name text not null, join_code text
);
create table public.workspace_members (
 workspace_id uuid references public.workspaces(id),
 user_id uuid references auth.users(id),
 role text not null,
 primary key(workspace_id,user_id)
);
alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
grant select on public.profiles to authenticated;
grant select,insert on public.workspaces,public.workspace_members to authenticated;
create policy fixtures_profile_own on public.profiles for select to authenticated
 using(id=(select auth.uid()));
create policy fixtures_workspace_own on public.workspaces for select to authenticated
 using(created_by=(select auth.uid()));
create policy fixtures_workspace_create on public.workspaces for insert to authenticated
 with check(created_by=(select auth.uid()));
create policy fixtures_members_own on public.workspace_members for select to authenticated
 using(user_id=(select auth.uid()));
create policy fixtures_members_join on public.workspace_members for insert to authenticated
 with check(user_id=(select auth.uid()));
-- Deterministic synthetic test users with no real emails, passwords, or tokens.
insert into auth.users (
 id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at
) values
 ('10000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','manager@fixture.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','central@fixture.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','school-a@fixture.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','school-b@fixture.invalid','',now(),now(),now()),
 ('10000000-0000-4000-8000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','planner-only@fixture.invalid','',now(),now(),now());
insert into public.profiles(id, full_name, username, email)
select id, split_part(email,'@',1),split_part(email,'@',1),email from auth.users
where email like '%@fixture.invalid';
insert into public.workspaces(id,created_by,name,join_code)
values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Existing Planner Workspace','FIXTURECODE12');
insert into public.workspace_members(workspace_id,user_id,role)
values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','super_admin'),
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000005','officer');
commit;
