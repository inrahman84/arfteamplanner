-- WorkFlow Planner V1.1.1 / production hotfix (2026-10-22)
-- Fix: POST /rest/v1/workspaces with Prefer: return=representation was
-- rejected by RLS SELECT policy before the AFTER INSERT trigger populated
-- workspace_members. The INSERT policy already requires created_by=auth.uid().
-- The creator must be able to read the row immediately, while other users
-- still require workspace membership.
-- Safe to apply without deleting or modifying existing workspace records.

drop policy if exists workspace_read on public.workspaces;
create policy workspace_read
  on public.workspaces
  for select
  to authenticated
  using (
    created_by = (select auth.uid())
    or public.is_workspace_member(id)
  );
