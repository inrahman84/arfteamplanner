\set ON_ERROR_STOP on
\echo 'ARF Media Hub V1.8.2 central user management permission matrix'
-- The v1.8.1 test fixture loads one Manager, one ARF Coordinator
-- and two School Coordinators. No existing production credentials involved.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
update public.media_members set planner_enabled=true
 where user_id='10000000-0000-4000-8000-000000000003';
do $test$ begin
 if not exists(select 1 from public.media_members where user_id='10000000-0000-4000-8000-000000000003' and planner_enabled)
   then raise exception 'ARF Coordinator cannot grant same new-workspace permission as Manager';end if;
end $test$;
-- Editing an existing Media assignment is authorized equally for coordinator.
update public.media_members set assigned_until=null,active=true
 where user_id='10000000-0000-4000-8000-000000000004';
-- Still protect the final ARF Manager; same hierarchy cannot remove the last holder.
do $test$ begin
 begin
  update public.media_members set active=false
   where user_id='10000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: final ARF Manager was disabled' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end $test$;
reset role;
-- School Coordinators cannot edit other users or Planner eligibility.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $test$ begin
 begin
  update public.media_members set planner_enabled=false
   where user_id='10000000-0000-4000-8000-000000000004';
  if found then raise exception 'FAIL: school coordinator changed another member' using errcode='ZX001';end if;
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end $test$;
reset role;
do $test$ declare anon_rpc integer; begin
 select count(*) into anon_rpc from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'media_%'
    and has_function_privilege('anon',p.oid,'EXECUTE');
 if anon_rpc>0 then raise exception 'Media Hub functions accessible without login: %',anon_rpc;end if;
end $test$;
\echo 'PASS: Media Hub V1.8.2 coordinator parity and privileged role safeguards'
