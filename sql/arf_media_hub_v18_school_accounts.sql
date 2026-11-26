-- Apply after all earlier Media Hub migrations in staging only.
begin;
create table public.media_school_accounts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 username text not null unique check(username ~ '^[a-z][a-z0-9_]{2,29}$'),
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.media_school_accounts enable row level security;
revoke all on public.media_school_accounts from public,anon,authenticated;
grant select on public.media_school_accounts to authenticated;
grant select,insert,update,delete on public.media_school_accounts to service_role;
create policy media_school_accounts_read on public.media_school_accounts for select to authenticated
 using (user_id=(select auth.uid()) or (select arf_media_private.current_role()) in ('arf_manager','arf_media_coordinator'));
create table public.media_school_account_events (
 id bigint generated always as identity primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid not null references auth.users(id),
 event text not null check(event in ('created','password_reset','revoked','restored')),
 occurred_at timestamptz not null default now()
);
alter table public.media_school_account_events enable row level security;
revoke all on public.media_school_account_events from public,anon,authenticated;
grant select,insert on public.media_school_account_events to service_role;
grant select on public.media_school_account_events to authenticated;
create policy media_account_event_read on public.media_school_account_events for select to authenticated using ((select arf_media_private.current_role())='arf_manager');
-- Only server-supplied app_metadata can initiate provisioning. Public signups
-- cannot set raw_app_meta_data. This trigger provisions membership atomically
-- with Auth creation, without inserting any Planner membership.
create function arf_media_private.provision_school_auth() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid; s uuid; u text; n text;
begin
 if new.raw_app_meta_data->>'arf_media_school_account' is distinct from 'true' then return new; end if;
 a:=(new.raw_app_meta_data->>'arf_media_created_by')::uuid;
 s:=(new.raw_app_meta_data->>'arf_media_school_id')::uuid;
 u:=lower(trim(new.raw_user_meta_data->>'username'));
 n:=trim(new.raw_user_meta_data->>'full_name');
 if a is null or not exists(select 1 from public.media_members m where m.user_id=a and m.active and m.role in ('arf_manager','arf_media_coordinator')) then raise exception 'Account provisioning denied'; end if;
 if s is null or not exists(select 1 from public.media_schools x where x.id=s and x.kind='school' and x.active) then raise exception 'Invalid school'; end if;
 if u is null or u !~ '^[a-z][a-z0-9_]{2,29}$' or n is null or length(n) not between 2 and 100 then raise exception 'Invalid identity'; end if;
 insert into public.media_school_accounts(user_id,username,created_by) values(new.id,u,a);
 insert into public.media_members(user_id,role,school_id,active,display_name) values(new.id,'school_media_coordinator',s,true,n);
 insert into public.media_school_account_events(user_id,actor_id,event) values(new.id,a,'created');
 return new;
end $$;
revoke all on function arf_media_private.provision_school_auth() from public,anon,authenticated;
create trigger on_arf_media_school_account_created after insert on auth.users for each row execute function arf_media_private.provision_school_auth();
-- This shared Auth project also has an existing ARF One School auto-enrollment
-- trigger. Preserve normal behavior, but skip dedicated Media Hub accounts.
do $$ begin
 if exists(select 1 from pg_trigger where tgrelid='auth.users'::regclass and tgname='on_arf_school_auth_user_created') then
  execute 'drop trigger on_arf_school_auth_user_created on auth.users';
  execute $ddl$create trigger on_arf_school_auth_user_created after insert on auth.users for each row when (new.raw_app_meta_data->>'arf_media_school_account' is distinct from 'true') execute function arf_internal.add_arf_school_member()$ddl$;
 end if;
end $$;
-- Dedicated school accounts cannot change into central roles or be assigned
-- Planner workspaces via invitation/self-created workspace or direct REST.
create function arf_media_private.protect_school_account() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='media_members' then
  if new.role<>'school_media_coordinator' and exists(select 1 from public.media_school_accounts a where a.user_id=new.user_id) then raise exception 'Dedicated school account cannot change role'; end if;
 elsif tg_table_name='workspace_members' then
  if exists(select 1 from public.media_school_accounts a where a.user_id=new.user_id) then raise exception 'Dedicated school account is Media Hub only'; end if;
 elsif tg_table_name='workspaces' then
  if exists(select 1 from public.media_school_accounts a where a.user_id=new.created_by) then raise exception 'Dedicated school account is Media Hub only'; end if;
 elsif tg_table_name='profiles' then
  if exists(select 1 from public.media_school_accounts a where a.user_id=new.id) and (new.username is distinct from old.username or new.email is distinct from old.email) then raise exception 'Dedicated login identity is managed by ARF'; end if;
 end if;
 return new;
end $$;
revoke all on function arf_media_private.protect_school_account() from public,anon,authenticated;
create trigger media_dedicated_role_guard before insert or update on public.media_members for each row execute function arf_media_private.protect_school_account();
create trigger media_dedicated_planner_member_guard before insert or update on public.workspace_members for each row execute function arf_media_private.protect_school_account();
create trigger media_dedicated_workspace_guard before insert or update on public.workspaces for each row execute function arf_media_private.protect_school_account();
create trigger media_dedicated_profile_guard before update on public.profiles for each row execute function arf_media_private.protect_school_account();
commit;
