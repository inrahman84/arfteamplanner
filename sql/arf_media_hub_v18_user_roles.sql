-- Apply after the existing Media Hub migrations. No Planner membership is changed.
begin;
-- Existing Planner RLS remains authoritative for the directory UI.
-- Independently enforce that a NEW Media Hub grant targets a member of a Planner
-- workspace managed by the acting ARF Manager. No global profile enumeration.
create function arf_media_private.can_grant_planner_user(target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select (select auth.uid()) is not null
 and (select arf_media_private.current_role())='arf_manager'
 and exists (
   select 1 from public.workspace_members actor
   join public.workspace_members candidate on candidate.workspace_id=actor.workspace_id
   where actor.user_id=(select auth.uid()) and actor.role in ('super_admin','manager')
     and candidate.user_id=target
 )
$$;
revoke all on function arf_media_private.can_grant_planner_user(uuid) from public,anon,authenticated;
grant execute on function arf_media_private.can_grant_planner_user(uuid) to authenticated;
drop policy media_members_add on public.media_members;
create policy media_members_add on public.media_members for insert to authenticated with check (
 (select arf_media_private.current_role())='arf_manager'
 and role in ('arf_media_coordinator','school_media_coordinator')
 and arf_media_private.can_grant_planner_user(user_id)
 and (school_id is null or exists(select 1 from public.media_schools s where s.id=school_id and s.kind='school' and s.active))
);
-- Existing memberships (including Media Hub-only members) may be edited/revoked,
-- but the user_id and bootstrap Manager role are immutable to application users.
drop policy media_members_edit on public.media_members;
create policy media_members_edit on public.media_members for update to authenticated
 using ((select arf_media_private.current_role())='arf_manager' and role<>'arf_manager')
 with check ((select arf_media_private.current_role())='arf_manager'
 and role in ('arf_media_coordinator','school_media_coordinator')
 and (school_id is null or exists(select 1 from public.media_schools s where s.id=school_id and s.kind='school' and (s.active or not media_members.active))));
revoke update on public.media_members from authenticated;
grant update (role,school_id,active,display_name) on public.media_members to authenticated;
commit;
