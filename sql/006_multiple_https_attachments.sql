-- V1.3.1: multiple HTTPS attachment links per Work Item (non-destructive).
-- Existing single attachment_url values remain in the old column for backward compatibility.
alter table public.tasks
 add column if not exists attachment_urls text[] not null default '{}'::text[];

-- Preserve old attachment links exactly once. Re-running is safe.
update public.tasks
 set attachment_urls=array[attachment_url]
 where coalesce(attachment_url,'')<>''
   and cardinality(attachment_urls)=0;

create or replace function public.valid_task_attachment_urls(links text[])
returns boolean
language sql
immutable
set search_path=''
as $$
 select links is not null
  and cardinality(links)<=20
  and not exists (
    select 1 from unnest(links) as entry(url)
    where entry.url is null
      or char_length(entry.url)>2048
      or entry.url !~ '^https://[^[:space:]]+$'
  );
$$;

do $$begin
  if not exists(
    select 1 from pg_constraint where conrelid='public.tasks'::regclass
      and conname='tasks_attachment_urls_valid'
  ) then
    alter table public.tasks add constraint tasks_attachment_urls_valid
    check (public.valid_task_attachment_urls(attachment_urls));
  end if;
end$$;

-- The helper is read-only, security invoker, and used by the CHECK constraint.
grant execute on function public.valid_task_attachment_urls(text[]) to authenticated;
revoke execute on function public.valid_task_attachment_urls(text[]) from anon;
