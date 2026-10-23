-- WorkFlow Planner V1.5: persist per-user order of Workspace Overview cards.
-- Non-destructive and scoped to authenticated user + a workspace they belong to.
create table if not exists public.dashboard_card_positions (
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 card_key text not null check(card_key in (
  'total','progress','hold','completed','pending','overdue',
  'calendar','deadlines','workload','approvals'
 )),
 sort_order int not null check(sort_order between 0 and 100),
 updated_at timestamptz not null default now(),
 primary key(workspace_id,user_id,card_key)
);
create index if not exists dashboard_card_positions_idx on public.dashboard_card_positions(workspace_id,user_id,sort_order);
alter table public.dashboard_card_positions enable row level security;
revoke all on table public.dashboard_card_positions from anon;
grant select,insert,update,delete on table public.dashboard_card_positions to authenticated;
drop policy if exists dashboard_card_positions_select on public.dashboard_card_positions;
create policy dashboard_card_positions_select on public.dashboard_card_positions for select to authenticated
 using (user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
drop policy if exists dashboard_card_positions_insert on public.dashboard_card_positions;
create policy dashboard_card_positions_insert on public.dashboard_card_positions for insert to authenticated
 with check(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
drop policy if exists dashboard_card_positions_update on public.dashboard_card_positions;
create policy dashboard_card_positions_update on public.dashboard_card_positions for update to authenticated
 using (user_id=(select auth.uid()) and public.is_workspace_member(workspace_id))
 with check(user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
drop policy if exists dashboard_card_positions_delete on public.dashboard_card_positions;
create policy dashboard_card_positions_delete on public.dashboard_card_positions for delete to authenticated
 using (user_id=(select auth.uid()) and public.is_workspace_member(workspace_id));
