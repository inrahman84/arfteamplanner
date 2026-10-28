-- V1.7.3: Shared order for Projects and Categories in Workspace Settings.
-- Sorting metadata is kept separate from the objects and Work Items.
create table if not exists public.management_item_positions (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 item_type text not null check(item_type in ('project','category')),
 item_id uuid not null,
 sort_order integer not null check(sort_order between 0 and 5000),
 updated_by uuid not null references public.profiles(id),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,item_type,item_id)
);
create index if not exists management_item_positions_sort_idx
 on public.management_item_positions(workspace_id,item_type,sort_order);
alter table public.management_item_positions enable row level security;
revoke all on public.management_item_positions from anon;
grant select,insert,update on public.management_item_positions to authenticated;
revoke delete on public.management_item_positions from authenticated;

create or replace function public.valid_management_item(p_workspace uuid,p_type text,p_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select case when p_type='project'
 then exists(select 1 from public.projects p where p.id=p_id and p.workspace_id=p_workspace)
 when p_type='category'
 then exists(select 1 from public.categories c where c.id=p_id and c.workspace_id=p_workspace)
 else false end
$$;
revoke all on function public.valid_management_item(uuid,text,uuid) from public,anon;
grant execute on function public.valid_management_item(uuid,text,uuid) to authenticated;
drop policy if exists management_item_positions_read on public.management_item_positions;
create policy management_item_positions_read on public.management_item_positions
 for select to authenticated
 using(public.is_workspace_member(workspace_id));
drop policy if exists management_item_positions_insert on public.management_item_positions;
create policy management_item_positions_insert on public.management_item_positions
 for insert to authenticated
 with check(updated_by=auth.uid() and public.is_workspace_member(workspace_id)
 and public.valid_management_item(workspace_id,item_type,item_id));
drop policy if exists management_item_positions_update on public.management_item_positions;
create policy management_item_positions_update on public.management_item_positions
 for update to authenticated using(public.is_workspace_member(workspace_id))
 with check(updated_by=auth.uid() and public.is_workspace_member(workspace_id)
 and public.valid_management_item(workspace_id,item_type,item_id));
