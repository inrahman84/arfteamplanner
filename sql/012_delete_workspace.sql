-- WorkFlow Planner 1.7.6: guarded permanent Workspace deletion.
-- Only the original creator who is still a Super Admin may delete a Workspace.
-- Child tables have ON DELETE CASCADE FKs; no unrelated profile is deleted.
begin;
alter table public.workspaces enable row level security;
revoke delete on public.workspaces from anon;
grant delete on public.workspaces to authenticated;
drop policy if exists workspace_delete on public.workspaces;
create policy workspace_delete on public.workspaces
  for delete to authenticated
  using (
    created_by = (select auth.uid())
    and public.has_workspace_role(id, array['super_admin'])
  );
commit;
