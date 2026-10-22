-- WorkFlow Planner V1.2: discussion and notification tables.
create table if not exists public.task_comments (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 task_id uuid not null references public.tasks(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 body text not null check (char_length(trim(body)) between 1 and 5000),
 mentioned_user_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(),
 constraint task_comments_mention_limit check (coalesce(array_length(mentioned_user_ids,1),0) <= 30)
);
create index if not exists task_comments_task_date on public.task_comments(task_id,created_at);
create index if not exists task_comments_workspace_date on public.task_comments(workspace_id,created_at desc);
alter table public.task_comments enable row level security;
revoke all on public.task_comments from public,anon,authenticated;
grant select,insert on public.task_comments to authenticated;
drop policy if exists task_comments_read on public.task_comments;
create policy task_comments_read on public.task_comments
 for select to authenticated using (
   public.is_workspace_member(workspace_id)
   and exists (select 1 from public.tasks t where t.id=task_id and t.workspace_id=task_comments.workspace_id)
 );
drop policy if exists task_comments_add on public.task_comments;
create policy task_comments_add on public.task_comments
 for insert to authenticated with check (
   author_id=(select auth.uid()) and public.is_workspace_member(workspace_id)
   and exists (select 1 from public.tasks t where t.id=task_id and t.workspace_id=task_comments.workspace_id)
 );

create table if not exists public.task_notifications (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 task_id uuid references public.tasks(id) on delete cascade,
 comment_id uuid references public.task_comments(id) on delete cascade,
 actor_id uuid references public.profiles(id),
 recipient_id uuid not null references public.profiles(id),
 kind text not null default 'comment' check (kind in ('comment','mention')),
 body_preview text not null default '',
 is_read boolean not null default false,
 created_at timestamptz not null default now()
);
create index if not exists task_notifications_recipient_date on public.task_notifications(recipient_id,created_at desc);
create index if not exists task_notifications_unread on public.task_notifications(recipient_id,created_at desc) where is_read=false;
alter table public.task_notifications enable row level security;
revoke all on public.task_notifications from public,anon,authenticated;
grant select on public.task_notifications to authenticated;
grant update(is_read) on public.task_notifications to authenticated;
drop policy if exists task_notifications_read on public.task_notifications;
create policy task_notifications_read on public.task_notifications
 for select to authenticated using (recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
drop policy if exists task_notifications_update on public.task_notifications;
create policy task_notifications_update on public.task_notifications
 for update to authenticated
 using (recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id))
 with check (recipient_id=(select auth.uid()) and public.is_workspace_member(workspace_id));

create or replace function public.create_task_comment_notifications()
returns trigger language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  insert into public.task_notifications(workspace_id,task_id,comment_id,actor_id,recipient_id,kind,body_preview)
  select new.workspace_id,new.task_id,new.id,new.author_id,r.user_id,
         case when r.user_id=any(new.mentioned_user_ids) then 'mention' else 'comment' end,
         left(new.body,180)
    from (
      select distinct member.user_id
        from public.workspace_members member
        join public.tasks task on task.workspace_id=member.workspace_id
       where task.id=new.task_id and member.workspace_id=new.workspace_id
         and member.user_id<>new.author_id
         and (member.user_id=any(new.mentioned_user_ids)
              or member.user_id=task.assigned_to
              or member.user_id=task.created_by)
    ) r;
  return new;
end $$;
revoke execute on function public.create_task_comment_notifications() from public,anon,authenticated;
drop trigger if exists task_comments_notify on public.task_comments;
create trigger task_comments_notify after insert on public.task_comments
 for each row execute function public.create_task_comment_notifications();
