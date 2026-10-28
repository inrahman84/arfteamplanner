-- WorkFlow Planner V1.6: soft archives and governed Due Date changes.
-- Existing Projects, Work Items, attachments, checklist and comments are preserved.
alter table public.projects
 add column if not exists archived_at timestamptz,
 add column if not exists archived_by uuid references public.profiles(id),
 add column if not exists created_by uuid references public.profiles(id);
alter table public.projects alter column created_by set default auth.uid();

alter table public.tasks
 add column if not exists archived_at timestamptz,
 add column if not exists archived_by uuid references public.profiles(id);

create index if not exists projects_workspace_archive_idx on public.projects(workspace_id,archived_at);
create index if not exists tasks_workspace_archive_idx on public.tasks(workspace_id,archived_at);

-- Only project managers (including Super Admin) or the person who created a
-- project can archive/restore it. Historical projects without created_by are
-- intentionally restricted to managerial roles.
create or replace function public.guard_project_archive()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.archived_at is distinct from old.archived_at then
  if not (public.has_workspace_role(old.workspace_id,array['super_admin','manager'])
       or old.created_by=(select auth.uid())) then
    raise exception 'Only project creator or Manager can archive/restore a project'
      using errcode='42501';
  end if;
  new.archived_by=case when new.archived_at is null then null else auth.uid() end;
 end if;
 return new;
end$$;
drop trigger if exists guard_project_archive on public.projects;
create trigger guard_project_archive before update on public.projects for each row
 execute function public.guard_project_archive();
revoke execute on function public.guard_project_archive() from public,anon,authenticated;

-- Enforce immutable committed due dates for ordinary members on ALL pathways
-- (REST updates, RPCs, bulk updates). Manager/Assistant Manager/Super Admin
-- can update them, but existing archive and attachment protections remain.
create or replace function public.guard_task_due_date()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.due_date is not null and new.due_date is distinct from old.due_date
   and auth.uid() is not null
   and not public.has_workspace_role(old.workspace_id,array['super_admin','manager','assistant_manager']) then
  raise exception 'Due Date changes require Manager or Assistant Manager approval'
    using errcode='42501';
 end if;
 return new;
end$$;
drop trigger if exists guard_task_due_date on public.tasks;
create trigger guard_task_due_date before update on public.tasks for each row
 execute function public.guard_task_due_date();
revoke execute on function public.guard_task_due_date() from public,anon,authenticated;

create table if not exists public.due_date_requests(
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 requested_by uuid not null references public.profiles(id),
 old_due_date date not null,
 proposed_due_date date not null,
 reason text not null check(char_length(btrim(reason)) between 5 and 1000),
 status text not null default 'Pending' check(status in ('Pending','Approved','Rejected')),
 reviewed_by uuid references public.profiles(id),
 reviewed_at timestamptz,
 review_note text not null default '',
 created_at timestamptz not null default now(),
 check(old_due_date<>proposed_due_date)
);
create unique index if not exists due_date_requests_one_pending_task
 on public.due_date_requests(task_id) where status='Pending';
create index if not exists due_date_requests_workspace_status
 on public.due_date_requests(workspace_id,status,created_at desc);
alter table public.due_date_requests enable row level security;
revoke all on public.due_date_requests from anon;
grant select,insert on public.due_date_requests to authenticated;
revoke update,delete on public.due_date_requests from authenticated;

drop policy if exists due_date_requests_select on public.due_date_requests;
create policy due_date_requests_select on public.due_date_requests for select to authenticated
 using (public.is_workspace_member(workspace_id));
drop policy if exists due_date_requests_insert on public.due_date_requests;
create policy due_date_requests_insert on public.due_date_requests for insert to authenticated
 with check(
  requested_by=(select auth.uid()) and status='Pending'
  and reviewed_by is null and reviewed_at is null
  and exists(
   select 1 from public.tasks t where t.id=task_id and t.workspace_id=due_date_requests.workspace_id
   and t.archived_at is null and t.due_date=old_due_date
   and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid()))
   and public.is_workspace_member(t.workspace_id)
  )
 );

-- No REST update access. Only this narrowly validated RPC can approve/reject.
create or replace function public.review_due_date_request(
 p_request_id uuid,p_approve boolean,p_note text default ''
) returns public.due_date_requests
language plpgsql security definer set search_path='' as $$
declare req public.due_date_requests; result public.due_date_requests;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into req from public.due_date_requests where id=p_request_id for update;
 if not found then raise exception 'Request not found' using errcode='P0002'; end if;
 if not public.has_workspace_role(req.workspace_id,array['super_admin','manager','assistant_manager']) then
  raise exception 'Only Manager or Assistant Manager can review Due Date' using errcode='42501';
 end if;
 if req.status<>'Pending' then raise exception 'Request already reviewed'; end if;
 if p_approve then
  update public.tasks set due_date=req.proposed_due_date
   where id=req.task_id and workspace_id=req.workspace_id
     and archived_at is null and due_date=req.old_due_date;
  if not found then raise exception 'Due Date changed or task archived; request is stale'; end if;
 end if;
 update public.due_date_requests set status=case when p_approve then 'Approved' else 'Rejected' end,
   reviewed_by=auth.uid(),reviewed_at=now(),review_note=left(coalesce(p_note,''),1000)
 where id=req.id returning * into result;
 return result;
end$$;
revoke all on function public.review_due_date_request(uuid,boolean,text) from public,anon;
grant execute on function public.review_due_date_request(uuid,boolean,text) to authenticated;
