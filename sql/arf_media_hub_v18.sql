-- ARF Media Hub v1.8: additive migration. Run in staging before production.
begin;
create schema if not exists arf_media_private;
revoke all on schema arf_media_private from public, anon, authenticated;
grant usage on schema arf_media_private to authenticated;
create table public.media_schools (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check (length(trim(name)) between 2 and 180),
 regional text not null default '',
 kind text not null default 'school' check (kind in ('school','foundation')),
 active boolean not null default true,
 instagram_handle text not null default '',
 tiktok_handle text not null default '',
 created_at timestamptz not null default now()
);
create unique index media_one_foundation on public.media_schools(kind) where kind='foundation';
create table public.media_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('arf_manager','arf_media_coordinator','school_media_coordinator')),
 school_id uuid references public.media_schools(id),
 active boolean not null default true,
 display_name text not null default '',
 check ((role='school_media_coordinator')=(school_id is not null))
);
create table public.media_contents (
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.media_schools(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 title text not null check(length(trim(title)) between 1 and 200),
 platform text not null check(platform in ('Instagram','TikTok')),
 format text not null check(format in ('Feed','Carousel','Reels','Video','Photo Carousel')),
 pillar text not null default 'Education & Learning',
 brief text not null default '',
 caption text not null default '',
 asset_url text not null default '' check(asset_url='' or asset_url ~ '^https://'),
 planned_date date not null,
 actual_date date,
 published_url text not null default '',
 post_key text,
 permission_checked boolean not null default false,
 status text not null default 'Planned' check(status in ('Idea','Planned','In Production','Ready','Scheduled','Submitted','Revision','Verified')),
 feedback text not null default '',
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 views bigint check(views>=0),
 likes bigint check(likes>=0),
 comments bigint check(comments>=0),
 shares bigint check(shares>=0),
 metrics_date date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check ((platform='Instagram' and format in ('Feed','Carousel','Reels')) or (platform='TikTok' and format in ('Video','Photo Carousel')))
);
create unique index media_unique_post on public.media_contents(platform,post_key) where post_key is not null;
create index media_contents_school_date on public.media_contents(school_id,actual_date);
create table public.media_audit_logs (
 id bigint generated always as identity primary key,
 content_id uuid not null references public.media_contents(id),
 school_id uuid not null references public.media_schools(id),
 actor_id uuid references auth.users(id),
 old_status text, new_status text not null,
 occurred_at timestamptz not null default now()
);
alter table public.media_schools enable row level security;
alter table public.media_members enable row level security;
alter table public.media_contents enable row level security;
alter table public.media_audit_logs enable row level security;
revoke all on public.media_schools,public.media_members,public.media_contents,public.media_audit_logs from public,anon,authenticated;
grant select,insert,update on public.media_schools,public.media_members,public.media_contents to authenticated;
grant select on public.media_audit_logs to authenticated;
-- Private authorization helpers; no user-controlled role claims.
create function arf_media_private.current_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.media_members where user_id=(select auth.uid()) and active
$$;
create function arf_media_private.can_read_school(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_members m where m.user_id=(select auth.uid()) and m.active
 and (m.role in ('arf_manager','arf_media_coordinator') or m.school_id=target))
$$;
create function arf_media_private.can_write_school(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.media_members m join public.media_schools s on s.id=target
 where m.user_id=(select auth.uid()) and m.active and s.active
 and (m.role in ('arf_manager','arf_media_coordinator') or (m.school_id=target and s.kind='school')))
$$;
revoke all on function arf_media_private.current_role(),arf_media_private.can_read_school(uuid),arf_media_private.can_write_school(uuid) from public,anon,authenticated;
grant execute on function arf_media_private.current_role(),arf_media_private.can_read_school(uuid),arf_media_private.can_write_school(uuid) to authenticated;
create policy media_members_read on public.media_members for select to authenticated using (user_id=(select auth.uid()) or (select arf_media_private.current_role()) in ('arf_manager','arf_media_coordinator'));
create policy media_members_add on public.media_members for insert to authenticated with check ((select arf_media_private.current_role())='arf_manager' and role<>'arf_manager' and (school_id is null or exists(select 1 from public.media_schools s where s.id=school_id and s.kind='school')));
create policy media_members_edit on public.media_members for update to authenticated using ((select arf_media_private.current_role())='arf_manager' and role<>'arf_manager') with check ((select arf_media_private.current_role())='arf_manager' and role<>'arf_manager' and (school_id is null or exists(select 1 from public.media_schools s where s.id=school_id and s.kind='school')));
create policy media_schools_read on public.media_schools for select to authenticated using (arf_media_private.can_read_school(id));
create policy media_schools_add on public.media_schools for insert to authenticated with check ((select arf_media_private.current_role())='arf_manager');
create policy media_schools_edit on public.media_schools for update to authenticated using ((select arf_media_private.current_role())='arf_manager') with check ((select arf_media_private.current_role())='arf_manager');
create policy media_contents_read on public.media_contents for select to authenticated using (arf_media_private.can_read_school(school_id));
create policy media_contents_add on public.media_contents for insert to authenticated with check (arf_media_private.can_write_school(school_id) and created_by=(select auth.uid()) and status<>'Verified' and status<>'Revision');
create policy media_contents_edit on public.media_contents for update to authenticated using (arf_media_private.can_write_school(school_id) and ((select arf_media_private.current_role()) in ('arf_manager','arf_media_coordinator') or created_by=(select auth.uid()))) with check (arf_media_private.can_write_school(school_id) and ((select arf_media_private.current_role()) in ('arf_manager','arf_media_coordinator') or created_by=(select auth.uid())));
create policy media_audit_read on public.media_audit_logs for select to authenticated using (arf_media_private.can_read_school(school_id));
create function arf_media_private.validate_content() returns trigger language plpgsql set search_path='' as $$
declare r text:=arf_media_private.current_role(); k text;
begin
 if r is null then raise exception 'Media Hub access required'; end if;
 if tg_op='INSERT' then
   if new.created_by is distinct from auth.uid() or new.status in ('Verified','Revision') or new.feedback<>'' then raise exception 'Invalid initial content'; end if;
   new.created_at:=now(); new.verified_by:=null; new.verified_at:=null;
 else
   if new.id is distinct from old.id or new.school_id is distinct from old.school_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then raise exception 'Immutable content identity'; end if;
   if old.status='Verified' and (new.title,new.platform,new.format,new.pillar,new.brief,new.caption,new.asset_url,new.planned_date,new.actual_date,new.published_url,new.permission_checked,new.status,new.feedback) is distinct from (old.title,old.platform,old.format,old.pillar,old.brief,old.caption,old.asset_url,old.planned_date,old.actual_date,old.published_url,old.permission_checked,old.status,old.feedback) then raise exception 'Verified record locked; correction requires controlled admin process'; end if;
   if (new.status is distinct from old.status and new.status in ('Verified','Revision')) or new.feedback is distinct from old.feedback then
     if r not in ('arf_manager','arf_media_coordinator') or old.created_by=auth.uid() then raise exception 'Independent reviewer required'; end if;
   end if;
   if new.status='Verified' and old.status<>'Verified' then
     if old.status<>'Submitted' then raise exception 'Submit publication before verification'; end if;
     if (new.platform,new.actual_date,new.published_url,new.permission_checked,new.title,new.format) is distinct from (old.platform,old.actual_date,old.published_url,old.permission_checked,old.title,old.format) then raise exception 'Review submitted evidence without changing it'; end if;
     new.verified_by:=auth.uid();new.verified_at:=now();
   else
     new.verified_by:=old.verified_by;new.verified_at:=old.verified_at;
   end if;
 end if;
 if new.status in ('Submitted','Verified') then
   if not new.permission_checked or new.actual_date is null or new.actual_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Valid publication date and media permission required'; end if;
   if new.platform='Instagram' then
      k:=substring(new.published_url from '^https://(?:www\.)?instagram\.com/(?:p|reel)/([A-Za-z0-9_-]+)/?(?:[?#].*)?$');
   else
      k:=substring(new.published_url from '^https://(?:www\.)?tiktok\.com/@[A-Za-z0-9._-]+/(?:video|photo)/([0-9]+)/?(?:[?#].*)?$');
   end if;
   if k is null then raise exception 'Use the full Instagram post/Reel or TikTok video/photo URL'; end if;
   new.post_key:=k;
 else new.post_key:=null;
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function arf_media_private.validate_content() from public,anon,authenticated;
create trigger media_validate_content before insert or update on public.media_contents for each row execute function arf_media_private.validate_content();
create function arf_media_private.audit_content() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authenticated actor required'; end if;
 if tg_op='INSERT' then insert into public.media_audit_logs(content_id,school_id,actor_id,new_status) values(new.id,new.school_id,auth.uid(),new.status);
 elsif new.status is distinct from old.status then insert into public.media_audit_logs(content_id,school_id,actor_id,old_status,new_status) values(new.id,new.school_id,auth.uid(),old.status,new.status);
 end if;
 return new;
end $$;
revoke all on function arf_media_private.audit_content() from public,anon,authenticated;
create trigger media_audit_content after insert or update on public.media_contents for each row execute function arf_media_private.audit_content();
commit;
-- Bootstrap only after confirming the exact manager's existing auth.users UUID:
-- insert into public.media_members(user_id,role,display_name) values ('<confirmed-uuid>','arf_manager','ARF Manager');
