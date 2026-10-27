-- Attachment links must remain readable after approval / Completed, but immutable
-- unless the stored task and the resulting task are both In Progress.
-- This migration does not modify existing Work Items or attachment data.
create or replace function public.guard_task_attachment_changes()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
begin
 if TG_OP='INSERT' then
  if NEW.status is distinct from 'In Progress'
   and (coalesce(cardinality(NEW.attachment_urls),0)>0
        or coalesce(NEW.attachment_url,'')<>'')
  then
   raise exception 'Attachment links can be added only while the Work Item is In Progress'
    using errcode='23514';
  end if;
 elsif (NEW.attachment_url is distinct from OLD.attachment_url
     or NEW.attachment_urls is distinct from OLD.attachment_urls)
     and (OLD.status is distinct from 'In Progress'
       or NEW.status is distinct from 'In Progress')
 then
  raise exception 'Attachment links cannot be edited or deleted outside In Progress'
   using errcode='23514';
 end if;
 return NEW;
end;
$$;

drop trigger if exists guard_task_attachment_changes on public.tasks;
create trigger guard_task_attachment_changes
before insert or update on public.tasks
for each row
execute function public.guard_task_attachment_changes();

-- This function is not an RPC endpoint.
revoke execute on function public.guard_task_attachment_changes() from public, anon, authenticated;
