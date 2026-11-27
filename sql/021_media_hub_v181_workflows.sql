-- ARF Media Hub V1.8.1 — school/account CRUD, global quotas,
-- role-routed review, atomic publishing and observation metrics.
-- Additive migration; historical school and publication records are retained.
begin;

-- School/account removal uses existing active flags rather than deleting history.
alter table public.media_accounts
 alter column handle set default ('media_' || replace(gen_random_uuid()::text,'-',''));
-- No platform password/handle is collected from users; previous handles stay for history.

-- Global weekly quota: null school_id means the same target for ALL schools.
alter table public.media_targets alter column school_id drop not null;
alter table public.media_targets add column if not exists active boolean not null default true;
create unique index if not exists media_target_global_start_unique
 on public.media_targets(platform,effective_from)
 where school_id is null and active;
drop policy if exists media_targets_read on public.media_targets;
create policy media_targets_read on public.media_targets for select to authenticated
 using(public.media_role() is not null and (school_id is null or public.media_can_read_school(school_id)));
create policy media_targets_manager_update on public.media_targets for update to authenticated
 using(public.media_is_manager()) with check(public.media_is_manager());

alter table public.media_contents add column if not exists author_role text not null default 'ARF_MANAGER'
 check(author_role in ('ARF_MANAGER','ARF_MEDIA_COORDINATOR','SCHOOL_MEDIA_COORDINATOR'));
alter table public.media_contents add column if not exists content_format text not null default 'Video Reels'
 check(content_format in ('Video Reels','Photo Feed Tunggal','Photo Feed Carousel'));
-- Preserve original author roles if any content predates this feature.
update public.media_contents c set author_role=coalesce((
 select m.role from public.media_members m where m.user_id=c.created_by),'ARF_MANAGER');

-- Track the latest metric observation for each published social post.
create table if not exists public.media_metrics(
 id uuid primary key default gen_random_uuid(),
 publication_id uuid not null unique references public.media_publications(id) on delete restrict,
 observed_at timestamptz not null default now(),
 views bigint not null default 0 check(views>=0),
 likes bigint not null default 0 check(likes>=0),
 comments bigint not null default 0 check(comments>=0),
 shares bigint not null default 0 check(shares>=0),
 updated_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now()
);
create or replace function public.media_guard_metric() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.media_publications p
  join public.media_contents c on c.id=p.content_id
  where p.id=new.publication_id and c.status='Published' and c.archived_at is null
    and public.media_can_write_school(p.school_id)) then
   raise exception 'Metrics are only allowed for accessible published content';end if;
 if new.observed_at>now()+interval '2 minutes' then raise exception 'Observation date cannot be in future';end if;
 if tg_op='UPDATE' and new.publication_id is distinct from old.publication_id
   then raise exception 'Metric publication cannot be changed';end if;
 new.updated_by:=auth.uid();new.updated_at:=now();return new;
end;$$;
create trigger guard_media_metrics before insert or update on public.media_metrics
 for each row execute function public.media_guard_metric();
alter table public.media_metrics enable row level security;
grant select,insert,update on public.media_metrics to authenticated;
revoke all on public.media_metrics from anon;
create policy media_metrics_read on public.media_metrics for select to authenticated
 using(exists(select 1 from public.media_publications p
   where p.id=publication_id and public.media_can_read_school(p.school_id)));
create policy media_metrics_insert on public.media_metrics for insert to authenticated
 with check(exists(select 1 from public.media_publications p
  join public.media_contents c on c.id=p.content_id
  where p.id=publication_id and c.status='Published' and public.media_can_write_school(p.school_id)));
create policy media_metrics_update on public.media_metrics for update to authenticated
 using(exists(select 1 from public.media_publications p
  join public.media_contents c on c.id=p.content_id
  where p.id=publication_id and c.status='Published' and public.media_can_write_school(p.school_id)))
 with check(exists(select 1 from public.media_publications p
  join public.media_contents c on c.id=p.content_id
  where p.id=publication_id and c.status='Published' and public.media_can_write_school(p.school_id)));

-- Content and target guards are updated below with their existing rules preserved.

create or replace function public.media_guard_target_dates() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not new.active then return new;end if;
 if new.effective_from < date_trunc('week',(now() at time zone 'Asia/Pontianak'))::date then
  raise exception 'Quota changes must not be backdated';end if;
 if exists(
  select 1 from public.media_targets t
  where t.school_id is not distinct from new.school_id and t.platform=new.platform and t.active
    and t.id is distinct from new.id
    and daterange(t.effective_from,coalesce(t.effective_until,'infinity'::date),'[]')
     && daterange(new.effective_from,coalesce(new.effective_until,'infinity'::date),'[]')
 ) then raise exception 'Effective target periods cannot overlap';end if;
 return new;
end;
$$;
create trigger media_target_range_guard before insert or update on public.media_targets
 for each row execute function public.media_guard_target_dates();


create or replace function public.media_guard_content() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  new.author_role:=coalesce(public.media_role(),'');
  if new.author_role not in ('ARF_MANAGER','ARF_MEDIA_COORDINATOR','SCHOOL_MEDIA_COORDINATOR') then raise exception 'Media Hub role required';end if;
  if new.created_by is distinct from auth.uid() then raise exception 'Invalid content author';end if;
  if new.review_status<>'pending' then raise exception 'Approval cannot be inserted by content editor';end if;
 end if;
 if tg_op='UPDATE' then
  if new.school_id is distinct from old.school_id or new.scope is distinct from old.scope
     then raise exception 'Content scope cannot be reassigned';end if;
  if old.strategic and not new.strategic and not public.media_is_manager() then
     raise exception 'Only Manager can downgrade strategic content';end if;
  if old.sensitive_flag and not new.sensitive_flag and not public.media_is_manager() then
     raise exception 'Only Manager can clear a sensitive content flag';end if;
  if new.status='In Review' and old.status='Revision' then
    new.review_status:='pending';new.version:=old.version+1;
  end if;
  if new.review_status is distinct from old.review_status and not (old.status='Revision' and new.status='In Review' and new.review_status='pending') then
    if not public.media_is_central() then raise exception 'Only central reviewers may change review status';end if;
    if new.review_status='approved' and not public.media_is_manager() then
      raise exception 'Strategic approvals require ARF Manager';end if;
    if coalesce(current_setting('app.media_review_rpc',true),'')<>'yes' then
      raise exception 'Review state may only change through audited review action';end if;
  end if;
  if new.strategic and (
     new.title is distinct from old.title or new.brief is distinct from old.brief or
     new.caption is distinct from old.caption or new.asset_url is distinct from old.asset_url or
     new.consent_checked is distinct from old.consent_checked or
     new.copyright_checked is distinct from old.copyright_checked or
     new.accuracy_checked is distinct from old.accuracy_checked or
     new.brand_checked is distinct from old.brand_checked)
     and old.review_status='approved' then
       new.review_status:='pending';new.version:=old.version+1;
  end if;
 end if;
 if new.status in ('Approved','Scheduled','Published') and new.review_status<>'approved' then
    raise exception 'Approved content review is required before scheduling or publishing';end if;
 if new.status='Approved' and (tg_op='INSERT' or new.status is distinct from old.status)
    then raise exception 'Approved must come from the reviewer and is scheduled automatically';end if;
 if new.status='Revision' and (tg_op='INSERT' or new.status is distinct from old.status)
    then raise exception 'Revision must come from review with written feedback';end if;
 if tg_op='UPDATE' and new.status='Published' and old.status is distinct from new.status
   and not exists(select 1 from public.media_publications p where p.content_id=new.id
      and p.verification_status in ('pending','verified') and p.public_url is not null)
   then raise exception 'At least one published platform URL is required';end if;
 if tg_op='INSERT' and new.status='Published' then raise exception 'Publish through approved content workflow';end if;
 if new.status in ('In Review','Approved','Scheduled','Published')
     and not (new.consent_checked and new.copyright_checked and new.accuracy_checked and new.brand_checked)
   then raise exception 'Consent, copyright, accuracy and brand checklist must be complete';end if;
 if new.sensitive_flag and new.status in ('Approved','Scheduled','Published') and new.review_status<>'approved'
   then raise exception 'Sensitive content requires Manager approval';end if;
 if new.strategic and new.status in ('Approved','Scheduled','Published') and new.review_status<>'approved'
   then raise exception 'Strategic content requires Manager approval';end if;
 new.updated_at:=now();
 return new;
end;
$$;


create or replace function public.media_review_content(p_content uuid,p_decision text,p_feedback text default '')
 returns boolean language plpgsql security definer set search_path='' as $$
declare rec public.media_contents%rowtype;
begin
 if not public.media_is_central() then raise exception 'Central media reviewer required';end if;
 if p_decision not in ('approved','revision','feedback') then raise exception 'Invalid review';end if;
 select * into rec from public.media_contents where id=p_content for update;
 if not found or rec.archived_at is not null or rec.status<>'In Review' then
   raise exception 'Only content In Review can be reviewed';end if;
 if rec.author_role='ARF_MEDIA_COORDINATOR' and not public.media_is_manager()
   then raise exception 'ARF Coordinator content requires ARF Manager review';end if;
 if rec.author_role='SCHOOL_MEDIA_COORDINATOR' and public.media_role() not in ('ARF_MEDIA_COORDINATOR','ARF_MANAGER')
   then raise exception 'School content requires ARF Coordinator review';end if;
 if rec.created_by=auth.uid() and rec.author_role<>'ARF_MANAGER' then
   raise exception 'Reviewer cannot approve own content';end if;
 if p_decision='revision' and length(btrim(coalesce(p_feedback,'')))<3
   then raise exception 'Revision feedback required';end if;
 insert into public.media_reviews(content_id,content_version,decision,feedback,reviewer_id)
 values(p_content,rec.version,p_decision,coalesce(p_feedback,''),auth.uid());
 if p_decision in ('approved','revision') then
  perform set_config('app.media_review_rpc','yes',true);
  update public.media_contents set review_status=case when p_decision='approved' then 'approved' else 'revision' end,
     status=case when p_decision='approved' then 'Scheduled' else 'Revision' end where id=p_content;
 end if;
 insert into public.media_audit_logs(actor_id,action,entity,entity_id,detail)
 values(auth.uid(),'review_'||p_decision,'media_contents',p_content,jsonb_build_object('version',rec.version));
 return true;
end;
$$;

-- Atomic publish transaction. Refuses missing/invalid links and refuses
-- publication before review; proof records and status commit together.
create or replace function public.media_publish_content(
  p_content uuid,p_posts jsonb,p_actual_at timestamptz default now()
) returns boolean language plpgsql security definer set search_path='' as $$
declare rec public.media_contents%rowtype; post jsonb;
 account uuid; platform text; url text; count_posts integer:=0;
begin
 if public.media_role() is null then raise exception 'Media Hub account required';end if;
 select * into rec from public.media_contents where id=p_content for update;
 if not found or rec.archived_at is not null then raise exception 'Content not found';end if;
 if not public.media_can_write_school(rec.school_id) then raise exception 'Content access denied';end if;
 if rec.review_status<>'approved' or rec.status not in ('Scheduled','Published')
  then raise exception 'Content must be approved and scheduled before publishing';end if;
 if p_posts is null or jsonb_typeof(p_posts)<>'array' or jsonb_array_length(p_posts)<1 or jsonb_array_length(p_posts)>2
  then raise exception 'Supply Instagram or TikTok publication URL';end if;
 if p_actual_at is null or p_actual_at>now()+interval '2 minutes'
  then raise exception 'Publication date cannot be in the future';end if;
 for post in select value from jsonb_array_elements(p_posts) as t(value) loop
  platform:=post->>'platform';
  url:=btrim(coalesce(post->>'url',''));
  if platform not in ('Instagram','TikTok') or url=''
    then raise exception 'A platform and HTTPS publication URL are required';end if;
  if (select count(*) from jsonb_array_elements(p_posts) pp where pp->>'platform'=platform)>1
    then raise exception 'Only one link per platform can be added at a time';end if;
  begin account:=(post->>'account_id')::uuid;
  exception when others then raise exception 'An active platform account must be selected';end;
  insert into public.media_publications
    (content_id,school_id,account_id,platform,format,planned_at,actual_at,public_url,verification_status)
  values (p_content,rec.school_id,account,platform,rec.content_format,
          rec.planned_at,p_actual_at,url,'pending');
  count_posts:=count_posts+1;
 end loop;
 if count_posts=0 then raise exception 'Publication URL required';end if;
 update public.media_contents set status='Published' where id=p_content;
 insert into public.media_audit_logs(actor_id,action,entity,entity_id,detail)
 values(auth.uid(),'publish_content','media_contents',p_content,jsonb_build_object('platform_count',count_posts));
 return true;
end;
$$;
revoke all on function public.media_publish_content(uuid,jsonb,timestamptz) from public,anon;
grant execute on function public.media_publish_content(uuid,jsonb,timestamptz) to authenticated;

-- Restrict new trigger function as previous media_* security hardening does.
revoke all on function public.media_guard_metric() from public,anon,authenticated;
commit;
