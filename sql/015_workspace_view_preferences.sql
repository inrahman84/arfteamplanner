-- WorkFlow Planner V1.7.2: per-user Grid/Gantt layout preferences.
-- No Work Items or Projects are updated or deleted.
create table if not exists public.workspace_view_preferences(
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 project_order uuid[] not null default '{}'::uuid[],
 work_item_width integer not null default 280 check(work_item_width between 190 and 800),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,user_id),
 constraint workspace_view_preferences_unique_projects check(
  cardinality(project_order)<=250 and array_position(project_order,null) is null
 )
);
alter table public.workspace_view_preferences enable row level security;
revoke all on public.workspace_view_preferences from anon;
grant select,insert,update on public.workspace_view_preferences to authenticated;
revoke delete on public.workspace_view_preferences from authenticated;

drop policy if exists view_preferences_read on public.workspace_view_preferences;
create policy view_preferences_read on public.workspace_view_preferences
 for select to authenticated
 using(user_id=auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists view_preferences_insert on public.workspace_view_preferences;
create policy view_preferences_insert on public.workspace_view_preferences
 for insert to authenticated
 with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
drop policy if exists view_preferences_update on public.workspace_view_preferences;
create policy view_preferences_update on public.workspace_view_preferences
 for update to authenticated
 using(user_id=auth.uid() and public.is_workspace_member(workspace_id))
 with check(user_id=auth.uid() and public.is_workspace_member(workspace_id));
