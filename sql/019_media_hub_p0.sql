-- ARF Media Hub V1.8.0 P0 — additive, isolated domain with strict RLS.
-- Never grant Media Hub access from Planner roles. Bootstrap first Manager
-- only via a separate privileged, audited admin operation.
begin;

create table if not exists public.media_schools (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code ~ '^[A-Za-z0-9_-]{2,30}$'),
 name text not null check(length(trim(name)) between 2 and 160),
 regional text not null default '',
 level text not null default 'SD',
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.media_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check(role in ('ARF_MANAGER','ARF_MEDIA_COORDINATOR','SCHOOL_MEDIA_COORDINATOR')),
 school_id uuid references public.media_schools(id),
 active boolean not null default true,
 assigned_from date not null default current_date,
 assigned_until date,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint media_school_role_match check ((role='SCHOOL_MEDIA_COORDINATOR' and school_id is not null) or (role<>'SCHOOL_MEDIA_COORDINATOR' and school_id is null))
);
create table if not exists public.media_accounts (
 id uuid primary key default gen_random_uuid(),
 scope text not null check(scope in ('ARF','SCHOOL')),
 school_id uuid references public.media_schools(id),
 platform text not null check(platform in ('Instagram','TikTok')),
 handle text not null check(length(trim(handle)) between 2 and 100),
 profile_url text check(profile_url is null or profile_url ~* '^https://[^[:space:]]+$'),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 constraint media_account_scope check((scope='ARF' and school_id is null) or (scope='SCHOOL' and school_id is not null))
);
create unique index if not exists media_accounts_one_handle on public.media_accounts(platform,lower(handle));
create table if not exists public.media_categories(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 active boolean not null default true
);
insert into public.media_categories(name) values
 ('Education & Learning'),('Student Achievement'),('People & Inspiration'),
 ('Character & Sustainability'),('School Life & Events'),('Foundation & Impact')
on conflict(name) do nothing;

create table if not exists public.media_targets(
 id uuid primary key default gen_random_uuid(),
 school_id uuid not null references public.media_schools(id),
 platform text not null check(platform in ('Instagram','TikTok')),
 quota integer not null default 2 check(quota between 0 and 100),
 effective_from date not null,
 effective_until date,
 reason text not null default '',
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 constraint media_target_dates check(effective_until is null or effective_until>=effective_from),
 unique(school_id,platform,effective_from)
);
create table if not exists public.media_contents (
 id uuid primary key default gen_random_uuid(),
 scope text not null default 'SCHOOL' check(scope in ('ARF','SCHOOL')),
 school_id uuid references public.media_schools(id),
 category_id uuid references public.media_categories(id),
 title text not null check(length(trim(title)) between 3 and 220),
 brief text not null default '',
 caption text not null default '',
 asset_url text check(asset_url is null or asset_url ~* '^https://[^[:space:]]+$'),
 assigned_to uuid references auth.users(id),
 created_by uuid not null default auth.uid() references auth.users(id),
 status text not null default 'Planned' check(status in ('Planned','In Production','In Review','Revision','Approved','Scheduled','Published')),
 strategic boolean not null default false,
 review_status text not null default 'pending' check(review_status in ('pending','revision','approved')),
 planned_at timestamptz,
 version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 archived_at timestamptz,
 constraint media_content_scope check((scope='ARF' and school_id is null) or(scope='SCHOOL' and school_id is not null))
);
create table if not exists public.media_publications(
 id uuid primary key default gen_random_uuid(),
 content_id uuid not null references public.media_contents(id) on delete restrict,
 school_id uuid references public.media_schools(id),
 account_id uuid references public.media_accounts(id),
 platform text not null check(platform in ('Instagram','TikTok')),
 format text not null default 'Video',
 planned_at timestamptz,
 actual_at timestamptz,
 public_url text,
 canonical_url text,
 evidence_url text,
 verification_status text not null default 'draft' check(verification_status in ('draft','pending','verified','rejected','withdrawn')),
 submitted_by uuid references auth.users(id),
 submitted_at timestamptz,
 verified_by uuid references auth.users(id),
 verified_at timestamptz,
 rejection_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint media_valid_public_url check(public_url is null or public_url ~* '^https://[^[:space:]]+$'),
 constraint media_valid_evidence_url check(evidence_url is null or evidence_url ~* '^https://[^[:space:]]+$')
);
create unique index if not exists media_publications_unique_post on public.media_publications(platform, canonical_url) where canonical_url is not null;
create index if not exists media_publications_school_date on public.media_publications(school_id,actual_at);
create index if not exists media_contents_school_status on public.media_contents(school_id,status);
create table if not exists public.media_reviews(
 id uuid primary key default gen_random_uuid(),
 content_id uuid not null references public.media_contents(id) on delete restrict,
 content_version integer not null,
 decision text not null check(decision in ('approved','revision','feedback')),
 feedback text not null default '',
 reviewer_id uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now()
);
create table if not exists public.media_audit_logs(
 id bigint generated always as identity primary key,
 actor_id uuid,
 action text not null,
 entity text not null,
 entity_id uuid,
 happened_at timestamptz not null default now(),
 detail jsonb not null default '{}'::jsonb
);

-- Security helpers intentionally return only the current actor's role/scope.
create or replace function public.media_role() returns text
language sql stable security definer set search_path='' as $$
 select m.role from public.media_members m
 where m.user_id=(select auth.uid()) and m.active
 and m.assigned_from<=((now() at time zone 'Asia/Pontianak')::date)
 and (m.assigned_until is null or m.assigned_until>=((now() at time zone 'Asia/Pontianak')::date));
$$;
create or replace function public.media_is_manager() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.media_role()='ARF_MANAGER',false);
$$;
create or replace function public.media_is_central() returns boolean
language sql stable security definer set search_path='' as $$
 select coalesce(public.media_role() in ('ARF_MANAGER','ARF_MEDIA_COORDINATOR'),false);
$$;
create or replace function public.media_can_read_school(p_school_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.media_is_central() or exists (
  select 1 from public.media_members m where m.user_id=(select auth.uid())
   and m.role='SCHOOL_MEDIA_COORDINATOR' and m.active
   and m.school_id=p_school_id and m.assigned_from<=((now() at time zone 'Asia/Pontianak')::date)
   and (m.assigned_until is null or m.assigned_until>=((now() at time zone 'Asia/Pontianak')::date))
 );
$$;
create or replace function public.media_can_write_school(p_school_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select public.media_is_central() or (
  p_school_id is not null and public.media_can_read_school(p_school_id)
 );
$$;

create or replace function public.media_canonical_url(p_url text) returns text
language plpgsql immutable set search_path='' as $$
declare clean text;
begin
 if p_url is null or btrim(p_url)='' then return null; end if;
 clean:=regexp_replace(btrim(p_url),'[?#].*$','');
 clean:=regexp_replace(clean,'/$', '');
 if clean !~* '^https://[^[:space:]]+$' then raise exception 'HTTPS URL required';end if;
 return lower(clean);
end;
$$;

create or replace function public.media_guard_content() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.created_by is distinct from auth.uid() then raise exception 'Invalid content author';end if;
  if new.review_status<>'pending' then raise exception 'Approval cannot be inserted by content editor';end if;
 end if;
 if tg_op='UPDATE' then
  if new.school_id is distinct from old.school_id or new.scope is distinct from old.scope
     then raise exception 'Content scope cannot be reassigned';end if;
  if not public.media_is_central() and new.review_status is distinct from old.review_status
     then raise exception 'Only central reviewers may change review status';end if;
  if new.strategic and (new.caption is distinct from old.caption or new.asset_url is distinct from old.asset_url)
     and old.review_status='approved' then
       new.review_status:='pending';new.version:=old.version+1;
  end if;
 end if;
 if new.strategic and new.status in ('Approved','Scheduled','Published') and new.review_status<>'approved'
   then raise exception 'Strategic content requires Manager approval';end if;
 new.updated_at:=now();
 return new;
end;
$$;

create or replace function public.media_guard_publication() returns trigger
language plpgsql security definer set search_path='' as $$
declare scope_school uuid; scope_type text; author uuid; account_school uuid; account_scope text; account_platform text; r text;
begin
 select c.school_id,c.scope,c.created_by into scope_school,scope_type,author
 from public.media_contents c where c.id=new.content_id;
 if not found then raise exception 'Content not found';end if;
 if new.school_id is distinct from scope_school then raise exception 'Publication school scope mismatch';end if;
 if new.account_id is not null then
   select a.school_id,a.scope,a.platform into account_school,account_scope,account_platform
   from public.media_accounts a where a.id=new.account_id and a.active;
   if not found or account_platform<>new.platform or account_scope<>scope_type
     or account_school is distinct from scope_school then raise exception 'Publication account mismatch';end if;
 end if;
 if new.actual_at>now()+interval '2 minutes' then raise exception 'Publication time in future';end if;
 new.canonical_url:=public.media_canonical_url(new.public_url);
 if new.verification_status in ('pending','verified','rejected') and
   (new.canonical_url is null or new.actual_at is null) then raise exception 'Publication URL and actual date required';end if;
 if tg_op='INSERT' then
   if new.verification_status not in ('draft','pending') then raise exception 'Only draft or submitted records may be created';end if;
   if new.verification_status='pending' then new.submitted_by:=auth.uid();new.submitted_at:=now();end if;
   new.verified_by:=null;new.verified_at:=null;new.rejection_reason:=null;
 else
   if new.content_id is distinct from old.content_id or new.school_id is distinct from old.school_id
     then raise exception 'Publication scope cannot be reassigned';end if;
   if old.verification_status='verified' and not public.media_is_manager()
     then raise exception 'Verified publication cannot be edited';end if;
   if new.verification_status in ('verified','rejected') and new.verification_status is distinct from old.verification_status then
     if not public.media_is_central() then raise exception 'Only central reviewers may verify publications';end if;
     if old.verification_status<>'pending' then raise exception 'Publication not pending verification';end if;
     if old.submitted_by=auth.uid() then raise exception 'Self verification is prohibited';end if;
     if new.verification_status='rejected' and length(btrim(coalesce(new.rejection_reason,'')))<3 then
      raise exception 'Rejection reason required';end if;
     new.verified_by:=auth.uid();new.verified_at:=now();
   elsif not public.media_is_central() then
     if new.verification_status not in ('draft','pending') then raise exception 'School may only submit publication';end if;
     if new.verified_by is distinct from old.verified_by or new.verified_at is distinct from old.verified_at then
      raise exception 'Verification fields protected';end if;
     if old.verification_status not in ('draft','rejected') and new is distinct from old
       then raise exception 'Only draft/rejected publication can be edited';end if;
   end if;
   if new.verification_status='pending' and old.verification_status in ('draft','rejected') then
     new.submitted_by:=auth.uid();new.submitted_at:=now();new.rejection_reason:=null;
     new.verified_by:=null;new.verified_at:=null;
   end if;
 end if;
 new.updated_at:=now();
 return new;
end;
$$;
create trigger guard_media_contents before insert or update on public.media_contents for each row execute function public.media_guard_content();
create trigger guard_media_publications before insert or update on public.media_publications for each row execute function public.media_guard_publication();

-- Every domain table is default-deny for all unauthenticated / non-Media users.
alter table public.media_schools enable row level security;
alter table public.media_members enable row level security;
alter table public.media_accounts enable row level security;
alter table public.media_categories enable row level security;
alter table public.media_targets enable row level security;
alter table public.media_contents enable row level security;
alter table public.media_publications enable row level security;
alter table public.media_reviews enable row level security;
alter table public.media_audit_logs enable row level security;
grant select,insert,update on public.media_schools,public.media_members,public.media_accounts,
 public.media_categories,public.media_targets,public.media_contents,public.media_publications to authenticated;
grant select,insert on public.media_reviews to authenticated;
grant select on public.media_audit_logs to authenticated;
grant usage on sequence public.media_audit_logs_id_seq to authenticated;
revoke all on public.media_schools,public.media_members,public.media_accounts,public.media_categories,
 public.media_targets,public.media_contents,public.media_publications,public.media_reviews,
 public.media_audit_logs from anon;
revoke all on function public.media_role(),public.media_is_manager(),public.media_is_central(),
 public.media_can_read_school(uuid),public.media_can_write_school(uuid) from public;
grant execute on function public.media_role(),public.media_is_manager(),public.media_is_central(),
 public.media_can_read_school(uuid),public.media_can_write_school(uuid) to authenticated;

create policy media_member_read on public.media_members for select to authenticated
 using(user_id=(select auth.uid()) or public.media_is_central());
create policy media_member_manager_insert on public.media_members for insert to authenticated
 with check(public.media_is_manager() or
   (public.media_role()='ARF_MEDIA_COORDINATOR' and role='SCHOOL_MEDIA_COORDINATOR'));
create policy media_member_manager_update on public.media_members for update to authenticated
 using(public.media_is_manager() or (public.media_role()='ARF_MEDIA_COORDINATOR' and role='SCHOOL_MEDIA_COORDINATOR'))
 with check(public.media_is_manager() or (public.media_role()='ARF_MEDIA_COORDINATOR' and role='SCHOOL_MEDIA_COORDINATOR'));

create policy media_schools_read on public.media_schools for select to authenticated
 using(public.media_can_read_school(id));
create policy media_schools_insert on public.media_schools for insert to authenticated
 with check(public.media_is_central());
create policy media_schools_update on public.media_schools for update to authenticated
 using(public.media_is_central()) with check(public.media_is_central());
create policy media_accounts_read on public.media_accounts for select to authenticated
 using(public.media_is_central() or public.media_can_read_school(school_id));
create policy media_accounts_insert on public.media_accounts for insert to authenticated
 with check(public.media_is_central());
create policy media_accounts_update on public.media_accounts for update to authenticated
 using(public.media_is_central()) with check(public.media_is_central());
create policy media_categories_read on public.media_categories for select to authenticated
 using(public.media_role() is not null);
create policy media_categories_write on public.media_categories for all to authenticated
 using(public.media_is_manager()) with check(public.media_is_manager());
create policy media_targets_read on public.media_targets for select to authenticated
 using(public.media_can_read_school(school_id));
create policy media_targets_write on public.media_targets for insert to authenticated
 with check(public.media_is_manager());
create policy media_contents_read on public.media_contents for select to authenticated
 using((scope='ARF' and public.media_is_central()) or (scope='SCHOOL' and public.media_can_read_school(school_id)));
create policy media_contents_insert on public.media_contents for insert to authenticated
 with check(((scope='ARF' and public.media_is_central()) or (scope='SCHOOL' and public.media_can_write_school(school_id))) and created_by=(select auth.uid()));
create policy media_contents_update on public.media_contents for update to authenticated
 using((scope='ARF' and public.media_is_central()) or (scope='SCHOOL' and public.media_can_write_school(school_id)))
 with check((scope='ARF' and public.media_is_central()) or (scope='SCHOOL' and public.media_can_write_school(school_id)));
create policy media_publications_read on public.media_publications for select to authenticated
 using(public.media_can_read_school(school_id));
create policy media_publications_insert on public.media_publications for insert to authenticated
 with check(public.media_can_write_school(school_id));
create policy media_publications_update on public.media_publications for update to authenticated
 using(public.media_can_write_school(school_id)) with check(public.media_can_write_school(school_id));
create policy media_reviews_read on public.media_reviews for select to authenticated
 using(exists(select 1 from public.media_contents c where c.id=content_id));
create policy media_reviews_insert on public.media_reviews for insert to authenticated
 with check(public.media_is_central() and reviewer_id=(select auth.uid()) and
 (decision<>'approved' or public.media_is_manager()));
create policy media_audit_read on public.media_audit_logs for select to authenticated
 using(public.media_is_central());

-- Manager approval is a controlled, version-specific transaction.
create or replace function public.media_review_content(p_content uuid,p_decision text,p_feedback text default '')
 returns boolean language plpgsql security invoker set search_path='' as $$
declare rec public.media_contents%rowtype;
begin
 if not public.media_is_central() or (p_decision='approved' and not public.media_is_manager())
   then raise exception 'Media reviewer permission required';end if;
 if p_decision not in ('approved','revision','feedback') then raise exception 'Invalid review';end if;
 select * into rec from public.media_contents where id=p_content for update;
 if not found then raise exception 'Content not available';end if;
 insert into public.media_reviews(content_id,content_version,decision,feedback,reviewer_id)
 values(p_content,rec.version,p_decision,coalesce(p_feedback,''),auth.uid());
 if p_decision in ('approved','revision') then
  update public.media_contents set review_status=case when p_decision='approved' then 'approved' else 'revision' end,
     status=case when p_decision='approved' then 'Approved' else 'Revision' end where id=p_content;
 end if;
 insert into public.media_audit_logs(actor_id,action,entity,entity_id,detail)
 values(auth.uid(),'review_'||p_decision,'media_contents',p_content,jsonb_build_object('version',rec.version));
 return true;
end;
$$;
-- audit logging requires the RPC to insert; expose narrow insert via audit trigger instead
create policy media_audit_rpc_insert on public.media_audit_logs for insert to authenticated
 with check(public.media_is_central() and actor_id=(select auth.uid()));
grant insert on public.media_audit_logs to authenticated;
grant execute on function public.media_review_content(uuid,text,text) to authenticated;

create or replace function public.media_verify_publication(p_publication uuid,p_decision text,p_reason text default '')
 returns boolean language plpgsql security invoker set search_path='' as $$
declare rec public.media_publications%rowtype;
begin
 if not public.media_is_central() then raise exception 'Central reviewer required';end if;
 if p_decision not in ('verified','rejected') then raise exception 'Invalid decision';end if;
 select * into rec from public.media_publications where id=p_publication for update;
 if not found or rec.verification_status<>'pending' then raise exception 'Publication not pending';end if;
 if rec.submitted_by=auth.uid() then raise exception 'Self verification prohibited';end if;
 if p_decision='rejected' and length(trim(p_reason))<3 then raise exception 'Reason is required';end if;
 update public.media_publications set verification_status=p_decision,
 rejection_reason=case when p_decision='rejected' then p_reason else null end
 where id=p_publication;
 insert into public.media_audit_logs(actor_id,action,entity,entity_id,detail)
 values(auth.uid(),p_decision,'media_publications',p_publication,jsonb_build_object('school_id',rec.school_id));
 return true;
end;
$$;
grant execute on function public.media_verify_publication(uuid,text,text) to authenticated;

-- Existing user profiles are readable to authorized Media Hub central staff
-- only for user management; this does not change Planner membership rights.
create policy media_central_profiles_read on public.profiles for select to authenticated
 using(public.media_is_central());

commit;
