-- V1.8.2: ARF central coordinators manage the same Media Hub memberships as
-- ARF Managers. Privileged Auth username/display-name updates remain in
-- media-school-accounts Edge (not direct profile PATCH).
-- The final active Manager is still protected by media_last_manager_guard.
begin;
drop policy if exists media_member_manager_insert on public.media_members;
drop policy if exists media_member_manager_update on public.media_members;
create policy media_member_central_insert on public.media_members
 for insert to authenticated with check(public.media_is_central());
create policy media_member_central_update on public.media_members
 for update to authenticated using(public.media_is_central())
 with check(public.media_is_central());

create or replace function public.media_guard_member_entitlements() returns trigger
 language plpgsql security definer set search_path='' as $body$
begin
 if tg_op='INSERT' and new.planner_enabled and not public.media_is_central()
   then raise exception 'Only central ARF Media Hub roles may grant Planner eligibility';end if;
 if tg_op='UPDATE' and (
    (new.planner_enabled is distinct from old.planner_enabled and not public.media_is_central())
    or (new.user_id is distinct from old.user_id)
    ) then raise exception 'Media member entitlement change not permitted';end if;
 return new;
end;
$body$;
-- Retain existing trigger and execution lockdown from migration 020.
revoke all on function public.media_guard_member_entitlements() from public,anon,authenticated;
commit;
