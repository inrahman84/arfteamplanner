-- WorkFlow Planner V1.7: support multiple Projects per Work Item.
-- Preserve project_id as the legacy primary Project for older clients/reports.
alter table public.tasks
 add column if not exists project_ids uuid[] not null default '{}'::uuid[];

-- Legacy Work Items retain their existing project_id. No backfill UPDATE is
-- needed, avoiding any change to approved Completed tasks. Clients fall back
-- to project_id when project_ids is empty, and new edits synchronize both.

create or replace function public.sync_task_project_ids()
returns trigger language plpgsql security invoker set search_path='' as $$
declare ids uuid[];candidate uuid;
begin
 if TG_OP='INSERT' then
  ids:=coalesce(new.project_ids,'{}'::uuid[]);
  if cardinality(ids)=0 and new.project_id is not null then
   ids:=array[new.project_id];
  end if;
 elsif new.project_ids is distinct from old.project_ids then
  ids:=coalesce(new.project_ids,'{}'::uuid[]);
 elsif new.project_id is distinct from old.project_id then
  -- Legacy clients may write only project_id. Preserve other associations.
  ids:=array_remove(coalesce(old.project_ids,'{}'::uuid[]),old.project_id);
  if new.project_id is not null then ids:=array_prepend(new.project_id,ids);end if;
 else
  ids:=coalesce(old.project_ids,'{}'::uuid[]);
 end if;
 if cardinality(ids)>20 then
  raise exception 'Maximum 20 Projects per Work Item' using errcode='23514';
 end if;
 if exists(select 1 from unnest(ids) as x(project_id)
   where x.project_id is null) or cardinality(ids)<>(select count(distinct x.project_id) from unnest(ids) as x(project_id)) then
   raise exception 'Project list must contain unique valid Project IDs' using errcode='23514';
 end if;
 foreach candidate in array ids loop
  if not exists(select 1 from public.projects p
   where p.id=candidate and p.workspace_id=new.workspace_id) then
   raise exception 'Project does not belong to this workspace' using errcode='23503';
  end if;
 end loop;
 new.project_ids:=ids;
 new.project_id:=case when cardinality(ids)>0 then ids[1] else null end;
 return new;
end$$;

drop trigger if exists sync_task_project_ids on public.tasks;
create trigger sync_task_project_ids before insert or update of project_ids,project_id,workspace_id on public.tasks
 for each row execute function public.sync_task_project_ids();
revoke all on function public.sync_task_project_ids() from public,anon,authenticated;

-- When a Project is deleted, remove only that association, retaining other Projects.
create or replace function public.cleanup_deleted_task_project()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 update public.tasks t set project_ids=array_remove(t.project_ids,old.id)
 where t.workspace_id=old.workspace_id and old.id=any(t.project_ids);
 return old;
end$$;

drop trigger if exists cleanup_deleted_task_project on public.projects;
create trigger cleanup_deleted_task_project after delete on public.projects
 for each row execute function public.cleanup_deleted_task_project();
revoke all on function public.cleanup_deleted_task_project() from public,anon,authenticated;
create index if not exists tasks_project_ids_gin on public.tasks using gin(project_ids);
