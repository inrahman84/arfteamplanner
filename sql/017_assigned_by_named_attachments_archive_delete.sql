-- V1.7.5: Assigned By, named HTTPS attachment links, archive-only permanent deletion.
-- No backfill UPDATE; legacy URLs and existing Work Items remain unchanged.
alter table public.tasks
 add column if not exists assigned_by uuid references public.profiles(id),
 add column if not exists attachment_names text[] not null default '{}'::text[];

create or replace function public.guard_task_attachment_metadata()
returns trigger language plpgsql security invoker set search_path='' as $$
declare entry text;
begin
 if cardinality(new.attachment_names)>20 then
  raise exception 'Maximum 20 attachment names' using errcode='23514';
 end if;
 if cardinality(new.attachment_names)>0 and cardinality(new.attachment_names)<>cardinality(new.attachment_urls) then
  raise exception 'Attachment name and URL counts must match' using errcode='23514';
 end if;
 foreach entry in array new.attachment_names loop
  if btrim(entry)='' or length(entry)>120 then
   raise exception 'Attachment names must be 1-120 characters' using errcode='23514';
  end if;
 end loop;
 if tg_op='UPDATE' and
    (new.attachment_names is distinct from old.attachment_names
     or new.attachment_urls is distinct from old.attachment_urls
     or new.attachment_url is distinct from old.attachment_url)
    and (old.status is distinct from 'In Progress' or new.status is distinct from 'In Progress')
 then
  raise exception 'Attachments can only change while the Work Item is In Progress' using errcode='23514';
 end if;
 return new;
end$$;
drop trigger if exists guard_task_attachment_metadata on public.tasks;
create trigger guard_task_attachment_metadata before insert or update on public.tasks
for each row execute function public.guard_task_attachment_metadata();
revoke all on function public.guard_task_attachment_metadata() from public,anon,authenticated;

-- Hard deletion is permitted only after archiving, by Manager / Super Admin.
-- Archived project links to existing tasks are removed by existing cleanup trigger;
-- the tasks themselves are not deleted.
create or replace function public.guard_archive_permanent_delete()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if old.archived_at is null then
  raise exception 'Archive this record before permanent deletion' using errcode='23514';
 end if;
 if not public.has_workspace_role(old.workspace_id,array['super_admin','manager']) then
  raise exception 'Only Manager or Super Admin can permanently delete archives' using errcode='42501';
 end if;
 return old;
end$$;
drop trigger if exists require_task_archive_before_delete on public.tasks;
create trigger require_task_archive_before_delete before delete on public.tasks
 for each row execute function public.guard_archive_permanent_delete();
drop trigger if exists require_project_archive_before_delete on public.projects;
create trigger require_project_archive_before_delete before delete on public.projects
 for each row execute function public.guard_archive_permanent_delete();
revoke all on function public.guard_archive_permanent_delete() from public,anon,authenticated;

-- Maintain original atomic New Task + Checklist workflow with the new fields.
create or replace function public.create_task_with_checklist(p_task jsonb,p_items jsonb)
returns public.tasks
language plpgsql security invoker set search_path='' as $$
declare created public.tasks;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 if jsonb_typeof(p_task)<>'object' or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>100
 then raise exception 'Invalid checklist payload';end if;
 if exists(select 1 from jsonb_array_elements(p_items) item
   where jsonb_typeof(item)<>'object' or nullif(btrim(item->>'title'),'') is null
   or char_length(btrim(item->>'title'))>250)
 then raise exception 'Checklist items need a title (1-250 chars)';end if;
 insert into public.tasks(
   workspace_id,project_id,project_ids,title,assigned_to,assigned_by,category_id,status,priority,
   start_date,due_date,notes,stakeholders,created_by,attachment_url,attachment_urls,attachment_names
 ) values(
   (p_task->>'workspace_id')::uuid,
   nullif(p_task->>'project_id','')::uuid,
   coalesce(array(select jsonb_array_elements_text(p_task->'project_ids')::uuid),'{}'::uuid[]),
   btrim(p_task->>'title'),
   nullif(p_task->>'assigned_to','')::uuid,
   nullif(p_task->>'assigned_by','')::uuid,
   nullif(p_task->>'category_id','')::uuid,
   coalesce(p_task->>'status','Not Started'),
   coalesce(p_task->>'priority','Medium'),
   nullif(p_task->>'start_date','')::date,
   nullif(p_task->>'due_date','')::date,
   coalesce(p_task->>'notes',''),coalesce(p_task->>'stakeholders',''),auth.uid(),
   coalesce(p_task->>'attachment_url',''),
   coalesce(array(select jsonb_array_elements_text(p_task->'attachment_urls')),'{}'::text[]),
   coalesce(array(select jsonb_array_elements_text(p_task->'attachment_names')),'{}'::text[])
 ) returning * into created;
 insert into public.task_checklist(task_id,workspace_id,title,is_done,position,created_by)
 select created.id,created.workspace_id,btrim(item.value->>'title'),
   coalesce((item.value->>'is_done')::boolean,false),(item.ordinality-1)::int,auth.uid()
 from jsonb_array_elements(p_items) with ordinality as item(value,ordinality);
 return created;
end$$;
revoke all on function public.create_task_with_checklist(jsonb,jsonb) from public,anon;
grant execute on function public.create_task_with_checklist(jsonb,jsonb) to authenticated;
