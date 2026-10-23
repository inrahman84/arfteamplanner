-- v1.5: create a work item and its draft checklist in one transaction.
-- SECURITY INVOKER preserves all existing tasks/task_checklist RLS policies.
create or replace function public.create_task_with_checklist(p_task jsonb,p_items jsonb)
returns public.tasks
language plpgsql
security invoker
set search_path=''
as $$
declare created public.tasks;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if jsonb_typeof(p_task) <> 'object'
   or jsonb_typeof(p_items) <> 'array'
   or jsonb_array_length(p_items)>100
 then raise exception 'Invalid checklist payload'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) item
   where jsonb_typeof(item)<>'object'
     or nullif(btrim(item->>'title'),'') is null
     or char_length(btrim(item->>'title'))>250)
 then raise exception 'Each checklist item needs a title (1-250 characters)'; end if;
 insert into public.tasks(
   workspace_id,project_id,title,assigned_to,category_id,status,priority,
   start_date,due_date,notes,stakeholders,created_by,attachment_url,attachment_urls
 )values(
   (p_task->>'workspace_id')::uuid,
   nullif(p_task->>'project_id','')::uuid,
   btrim(p_task->>'title'),
   nullif(p_task->>'assigned_to','')::uuid,
   nullif(p_task->>'category_id','')::uuid,
   coalesce(p_task->>'status','Not Started'),
   coalesce(p_task->>'priority','Medium'),
   nullif(p_task->>'start_date','')::date,
   nullif(p_task->>'due_date','')::date,
   coalesce(p_task->>'notes',''),
   coalesce(p_task->>'stakeholders',''),
   auth.uid(),
   coalesce(p_task->>'attachment_url',''),
   coalesce(array(select jsonb_array_elements_text(p_task->'attachment_urls')),'{}'::text[])
 ) returning * into created;
 insert into public.task_checklist(task_id,workspace_id,title,is_done,position,created_by)
 select created.id,created.workspace_id,btrim(item.value->>'title'),
   coalesce((item.value->>'is_done')::boolean,false),
   (item.ordinality - 1)::int,
   auth.uid()
 from jsonb_array_elements(p_items) with ordinality as item(value,ordinality);
 return created;
end;
$$;
revoke all on function public.create_task_with_checklist(jsonb,jsonb) from public,anon;
grant execute on function public.create_task_with_checklist(jsonb,jsonb) to authenticated;
