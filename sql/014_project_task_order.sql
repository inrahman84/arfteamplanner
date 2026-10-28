-- V1.7.1: project-specific ordering of Work Items.
-- Positions are separate metadata: moving a Completed item must not modify its task record.
create table if not exists public.project_task_positions(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 project_id uuid not null references public.projects(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 sort_order integer not null check(sort_order>=0 and sort_order<=200000),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(project_id,task_id)
);
create index if not exists project_task_positions_workspace_project_order
 on public.project_task_positions(workspace_id,project_id,sort_order,task_id);
alter table public.project_task_positions enable row level security;
revoke all on public.project_task_positions from anon;
grant select,insert,update on public.project_task_positions to authenticated;
revoke delete on public.project_task_positions from authenticated;

drop policy if exists project_task_positions_select on public.project_task_positions;
create policy project_task_positions_select on public.project_task_positions
 for select to authenticated using(public.is_workspace_member(workspace_id));

drop policy if exists project_task_positions_insert on public.project_task_positions;
create policy project_task_positions_insert on public.project_task_positions
 for insert to authenticated with check(
  updated_by=auth.uid()
  and public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer'])
  and exists(select 1 from public.projects p where p.id=project_id and p.workspace_id=project_task_positions.workspace_id and p.archived_at is null)
  and exists(select 1 from public.tasks t where t.id=task_id and t.workspace_id=project_task_positions.workspace_id and t.archived_at is null
    and (project_id=any(t.project_ids) or (cardinality(t.project_ids)=0 and t.project_id=project_task_positions.project_id)))
 );

drop policy if exists project_task_positions_update on public.project_task_positions;
create policy project_task_positions_update on public.project_task_positions
 for update to authenticated
 using(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']))
 with check(
  updated_by=auth.uid()
  and public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer'])
  and exists(select 1 from public.projects p where p.id=project_id and p.workspace_id=project_task_positions.workspace_id and p.archived_at is null)
  and exists(select 1 from public.tasks t where t.id=task_id and t.workspace_id=project_task_positions.workspace_id and t.archived_at is null
    and (project_id=any(t.project_ids) or (cardinality(t.project_ids)=0 and t.project_id=project_task_positions.project_id)))
 );
