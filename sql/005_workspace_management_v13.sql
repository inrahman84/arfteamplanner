-- WorkFlow Planner V1.3: reversible additions, existing tasks preserved.
alter table public.workspace_members
  add column if not exists display_name text,
  add column if not exists display_job_title text;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='workspace_member_name_override_length') then
    alter table public.workspace_members add constraint workspace_member_name_override_length
    check (display_name is null or (char_length(btrim(display_name)) between 2 and 100));
  end if;
  if not exists(select 1 from pg_constraint where conname='workspace_member_job_override_length') then
    alter table public.workspace_members add constraint workspace_member_job_override_length
    check (display_job_title is null or char_length(display_job_title)<=120);
  end if;
end $$;

-- Explicitly scoped by BOTH workspace_id and user_id; no cross-workspace changes.
create table if not exists public.workload_positions(
 workspace_id uuid not null,
 user_id uuid not null,
 sort_order integer not null check (sort_order between 0 and 100000),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,user_id),
 constraint workload_position_member_fk foreign key(workspace_id,user_id)
   references public.workspace_members(workspace_id,user_id) on delete cascade
);
create index if not exists workload_positions_order_idx
 on public.workload_positions(workspace_id,sort_order);
alter table public.workload_positions enable row level security;
grant select,insert,update,delete on public.workload_positions to authenticated;
revoke all on public.workload_positions from anon;
drop policy if exists workload_positions_read on public.workload_positions;
create policy workload_positions_read on public.workload_positions for select to authenticated
 using (public.is_workspace_member(workspace_id));
drop policy if exists workload_positions_insert on public.workload_positions;
create policy workload_positions_insert on public.workload_positions for insert to authenticated
 with check(public.has_workspace_role(workspace_id,array['super_admin','manager']));
drop policy if exists workload_positions_update on public.workload_positions;
create policy workload_positions_update on public.workload_positions for update to authenticated
 using(public.has_workspace_role(workspace_id,array['super_admin','manager']))
 with check(public.has_workspace_role(workspace_id,array['super_admin','manager']));
drop policy if exists workload_positions_delete on public.workload_positions;
create policy workload_positions_delete on public.workload_positions for delete to authenticated
 using(public.has_workspace_role(workspace_id,array['super_admin','manager']));

-- Existing project/category FK relations use ON DELETE SET NULL, keeping tasks intact.
