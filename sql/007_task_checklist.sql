-- WorkFlow Planner V1.4: per-Work Item checklist (non-destructive).
create table if not exists public.task_checklist(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.tasks(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 title text not null check(char_length(btrim(title)) between 1 and 250),
 is_done boolean not null default false,
 position integer not null default 0 check(position between 0 and 100000),
 created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists task_checklist_task_position_idx
 on public.task_checklist(task_id,position,created_at);
alter table public.task_checklist enable row level security;
revoke all on public.task_checklist from anon;
grant select,insert,update,delete on public.task_checklist to authenticated;

-- Read within workspace only, and require checklist row to match parent task.
drop policy if exists task_checklist_read on public.task_checklist;
create policy task_checklist_read on public.task_checklist for select to authenticated
 using(public.is_workspace_member(workspace_id) and exists(
  select 1 from public.tasks t
  where t.id=task_checklist.task_id and t.workspace_id=task_checklist.workspace_id
 ));

-- Editors: Manager/Super Admin, or creator/assignee of non-completed task.
-- Mirrors existing Work Item task-edit intent.
drop policy if exists task_checklist_insert on public.task_checklist;
create policy task_checklist_insert on public.task_checklist for insert to authenticated
 with check(created_by=(select auth.uid()) and exists(
  select 1 from public.tasks t
  where t.id=task_checklist.task_id and t.workspace_id=task_checklist.workspace_id
  and (public.has_workspace_role(t.workspace_id,array['super_admin','manager'])
    or (t.status<>'Completed' and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid()))
      and public.has_workspace_role(t.workspace_id,array['assistant_manager','specialist','admin','officer'])))
 ));
drop policy if exists task_checklist_update on public.task_checklist;
create policy task_checklist_update on public.task_checklist for update to authenticated
 using(exists(select 1 from public.tasks t where t.id=task_checklist.task_id
  and t.workspace_id=task_checklist.workspace_id and
  (public.has_workspace_role(t.workspace_id,array['super_admin','manager'])
   or (t.status<>'Completed' and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid()))
    and public.has_workspace_role(t.workspace_id,array['assistant_manager','specialist','admin','officer'])))))
 with check(exists(select 1 from public.tasks t where t.id=task_checklist.task_id
  and t.workspace_id=task_checklist.workspace_id and
  (public.has_workspace_role(t.workspace_id,array['super_admin','manager'])
   or (t.status<>'Completed' and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid()))
    and public.has_workspace_role(t.workspace_id,array['assistant_manager','specialist','admin','officer'])))));
drop policy if exists task_checklist_delete on public.task_checklist;
create policy task_checklist_delete on public.task_checklist for delete to authenticated
 using(exists(select 1 from public.tasks t where t.id=task_checklist.task_id
  and t.workspace_id=task_checklist.workspace_id and
  (public.has_workspace_role(t.workspace_id,array['super_admin','manager'])
   or (t.status<>'Completed' and (t.created_by=(select auth.uid()) or t.assigned_to=(select auth.uid()))
    and public.has_workspace_role(t.workspace_id,array['assistant_manager','specialist','admin','officer'])))));
