-- V1.6 security hardening: Project creator identity is immutable.
-- Prevents a member from modifying created_by to gain archive/restore rights.
create or replace function public.guard_project_archive()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if TG_OP='INSERT' then
  if auth.uid() is not null and new.created_by is distinct from auth.uid() then
   raise exception 'Project creator must be the authenticated user'
    using errcode='42501';
  end if;
  return new;
 end if;
 if new.created_by is distinct from old.created_by then
  raise exception 'Project creator cannot be reassigned' using errcode='42501';
 end if;
 if new.archived_at is distinct from old.archived_at then
  if not (public.has_workspace_role(old.workspace_id,array['super_admin','manager'])
       or old.created_by=(select auth.uid())) then
    raise exception 'Only Project creator or Manager can archive/restore'
     using errcode='42501';
  end if;
  new.archived_by=case when new.archived_at is null then null else auth.uid() end;
 end if;
 return new;
end$$;
drop trigger if exists guard_project_archive on public.projects;
create trigger guard_project_archive before insert or update on public.projects
 for each row execute function public.guard_project_archive();
revoke execute on function public.guard_project_archive() from public,anon,authenticated;
