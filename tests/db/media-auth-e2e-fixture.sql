-- Synthetic cross-product Auth triggers on disposable local Supabase only.
-- Mirrors the production ARF One School automatic operator enrollment.
create schema if not exists arf_internal;
create table if not exists public.arf_school_members(
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 display_name text not null default '',
 position text,
 role text not null default 'SCHOOL_OPERATOR',
 assigned_schools text[] not null default '{}',
 assigned_regions text[] not null default '{}',
 status text not null default 'ACTIVE'
);
create or replace function public.create_user_profile() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
 insert into public.profiles(id,email,full_name,username)
 values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',''),
  nullif(lower(trim(coalesce(new.raw_user_meta_data->>'username',''))),''))
 on conflict(id) do nothing;
 return new;
end;
$function$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_user_profile();
create or replace function arf_internal.add_arf_school_member() returns trigger
language plpgsql security definer set search_path='' as $function$
begin
 if new.email is null then return new;end if;
 insert into public.arf_school_members(user_id,email,display_name,role,assigned_schools,assigned_regions,status)
 values(new.id,lower(new.email),coalesce(new.raw_user_meta_data->>'full_name',''),'SCHOOL_OPERATOR','{}','{}','ACTIVE')
 on conflict(user_id) do nothing;
 return new;
end;
$function$;
create trigger on_arf_school_auth_user_created after insert on auth.users
for each row execute function arf_internal.add_arf_school_member();

insert into public.media_schools(id,code,name,regional,level)
values('30000000-0000-4000-8000-000000000001','CI_SCHOOL_A','School A for E2E','Regional 1','SD')
on conflict(id) do nothing;
