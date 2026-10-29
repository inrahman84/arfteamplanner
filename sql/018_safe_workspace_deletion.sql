-- WorkFlow Planner V1.7.7 — atomic deletion of a Workspace.
-- V1.7.6 DELETE via PostgREST was blocked by the archive-before-delete
-- trigger when ON DELETE CASCADE tried to delete non-archived Projects/Tasks.
-- All authorization and data changes run as the calling user (SECURITY INVOKER).
-- No existing archive safeguards are bypassed.

create or replace function public.delete_workspace_permanently(
  p_workspace_id uuid,
  p_confirm_name text
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_name text;
  v_creator uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='42501';
  end if;

  select w.name,w.created_by into v_name,v_creator
  from public.workspaces w
  where w.id=p_workspace_id
  for update;

  if not found then
    raise exception 'Workspace not found or no access' using errcode='P0002';
  end if;

  if v_creator is distinct from auth.uid()
     or not public.has_workspace_role(p_workspace_id,array['super_admin']) then
    raise exception 'Only the Workspace creator with Super Admin role can delete it'
      using errcode='42501';
  end if;

  if p_confirm_name is distinct from v_name then
    raise exception 'Workspace name confirmation does not match'
      using errcode='22023';
  end if;

  -- Existing archive guards are respected before deleting child records.
  -- The containing RPC statement is atomic: any failure rolls back everything.
  update public.tasks
     set archived_at=now(),archived_by=auth.uid()
   where workspace_id=p_workspace_id and archived_at is null;

  delete from public.tasks where workspace_id=p_workspace_id;

  update public.projects
     set archived_at=now(),archived_by=auth.uid()
   where workspace_id=p_workspace_id and archived_at is null;

  delete from public.projects where workspace_id=p_workspace_id;

  -- Remaining dependent records (Categories, Members, Preferences, etc.)
  -- are removed through existing ON DELETE CASCADE foreign keys.
  delete from public.workspaces where id=p_workspace_id;
  if not found then
    raise exception 'Workspace deletion did not complete' using errcode='P0002';
  end if;

  return true;
end;
$$;

revoke all on function public.delete_workspace_permanently(uuid,text) from public,anon;
grant execute on function public.delete_workspace_permanently(uuid,text) to authenticated;
