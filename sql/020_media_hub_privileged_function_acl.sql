-- ARF Media Hub V1.8.0 privileged function execution hardening.
-- Supabase default privileges can grant EXECUTE directly to anon; revoking
-- only from PUBLIC is insufficient. Restrict all media_* functions explicitly.
do $harden$
declare r record;
begin
 for r in
  select p.oid, p.proname, p.prorettype
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'media_%'
 loop
  execute format('revoke all on function %s from public, anon', r.oid::regprocedure);
  if r.prorettype = 'pg_catalog.trigger'::regtype or r.proname='media_canonical_url' then
   execute format('revoke all on function %s from authenticated', r.oid::regprocedure);
  end if;
 end loop;
end;
$harden$;
grant execute on function public.media_role(), public.media_is_manager(), public.media_is_central(),
 public.media_can_read_school(uuid), public.media_can_write_school(uuid), public.media_planner_blocked()
 to authenticated;
grant execute on function public.media_review_content(uuid,text,text),
 public.media_verify_publication(uuid,text,text), public.media_withdraw_publication(uuid,text)
 to authenticated;
