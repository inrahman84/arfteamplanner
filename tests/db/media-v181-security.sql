\set ON_ERROR_STOP on
\echo 'ARF Media Hub V1.8.1 workflow, global targets and metrics role tests'
-- Requires old media-security.sql suite to have loaded synthetic Manager,
-- ARF coordinator, and school A/B identities and the original school fixtures.

-- Foundation-wide targets use school_id NULL, visible from both schools.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
insert into public.media_targets(id,school_id,platform,quota,effective_from,reason)
values('70000000-0000-4000-8000-000000000001',null,'Instagram',4,
       date_trunc('week',(now() at time zone 'Asia/Pontianak'))::date,'Foundation target');
do $t$begin
 if (select count(*) from public.media_targets where school_id is null and platform='Instagram')<>1
 then raise exception 'Global target not inserted';end if;
end$t$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $t$begin
 if (select count(*) from public.media_targets where school_id is null and platform='Instagram' and quota=4)<>1
 then raise exception 'School A cannot view global target';end if;
end$t$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $t$begin
 if (select count(*) from public.media_targets where school_id is null and platform='Instagram' and quota=4)<>1
 then raise exception 'School B cannot view global target';end if;
end$t$;
reset role;

-- Account no longer needs an input Handle; ARF account has no school.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
insert into public.media_accounts(id,scope,school_id,platform,profile_url)
values ('80000000-0000-4000-8000-000000000001','SCHOOL',
        '30000000-0000-4000-8000-000000000001','Instagram','https://instagram.com/example_a'),
       ('80000000-0000-4000-8000-000000000002','ARF',null,'TikTok',null);
do $t$begin
 if not exists(select 1 from public.media_accounts where id='80000000-0000-4000-8000-000000000002'
   and scope='ARF' and school_id is null and length(handle)>5)
 then raise exception 'ARF account created incorrectly without Handle input';end if;
end$t$;
reset role;

-- School coordinator creates submitted content; reviewer is ARF coordinator.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
insert into public.media_contents(id,scope,school_id,title,brief,caption,created_by,status,content_format,
 consent_checked,copyright_checked,accuracy_checked,brand_checked)
values('50000000-0000-4000-8000-000000000002','SCHOOL',
 '30000000-0000-4000-8000-000000000001','School literacy campaign',
 'School literacy program','Literacy!',(select auth.uid()),'In Review','Photo Feed Carousel',
 true,true,true,true);
do $t$begin
 if (select author_role from public.media_contents where id='50000000-0000-4000-8000-000000000002')<>'SCHOOL_MEDIA_COORDINATOR'
 then raise exception 'Author role was not captured on insert';end if;
 begin
 update public.media_contents set status='Published'
 where id='50000000-0000-4000-8000-000000000002';
 raise exception 'FAIL: Published without approval/link' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
reset role;

-- Client-side content author role / author ID cannot be forged.
do $t$begin
 begin
  update public.media_contents set author_role='ARF_MEDIA_COORDINATOR'
   where id='50000000-0000-4000-8000-000000000002';
  raise exception 'FAIL: Author role tampering allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
 begin
  update public.media_contents set created_by='10000000-0000-4000-8000-000000000001'
   where id='50000000-0000-4000-8000-000000000002';
  raise exception 'FAIL: Created-by tampering allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
reset role;

-- ARF coordinator may approve school content (without Manager intervention).
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.media_review_content('50000000-0000-4000-8000-000000000002','approved','Ready to schedule');
do $t$begin
 if (select status from public.media_contents where id='50000000-0000-4000-8000-000000000002')<>'Scheduled'
 then raise exception 'Approved must automatically become Scheduled';end if;
end$t$;
reset role;

-- ARF coordinator's own content must be reviewed by ARF Manager.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
insert into public.media_contents(id,scope,school_id,title,brief,created_by,status,
 consent_checked,copyright_checked,accuracy_checked,brand_checked)
values('50000000-0000-4000-8000-000000000003','ARF',null,'Foundation education story',
 'Foundation program',(select auth.uid()),'In Review',true,true,true,true);
do $t$begin
 begin
 perform public.media_review_content('50000000-0000-4000-8000-000000000003','approved','');
 raise exception 'FAIL: ARF coordinator approved own content' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $t$begin
 begin
 perform public.media_review_content('50000000-0000-4000-8000-000000000003','revision','');
 raise exception 'FAIL: Revision without written feedback' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
select public.media_review_content('50000000-0000-4000-8000-000000000003',
 'revision','Perbaiki narasi profil sekolah');
do $t$begin
 if (select status from public.media_contents where id='50000000-0000-4000-8000-000000000003')<>'Revision'
 then raise exception 'Revision status not recorded';end if;
 if not exists(select 1 from public.media_reviews where content_id='50000000-0000-4000-8000-000000000003'
   and feedback like '%narasi%') then raise exception 'Revision feedback missing';end if;
end$t$;
reset role;

-- Resubmit after revision and receive Manager's approved→scheduled.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
update public.media_contents set status='In Review' where id='50000000-0000-4000-8000-000000000003';
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.media_review_content('50000000-0000-4000-8000-000000000003','approved','Good');
do $t$begin
 if (select status from public.media_contents where id='50000000-0000-4000-8000-000000000003')<>'Scheduled'
 then raise exception 'Manager approval did not schedule';end if;
end$t$;
reset role;

-- School publishes atomically with HTTPS post proof.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $t$begin
 begin
 perform public.media_publish_content('50000000-0000-4000-8000-000000000002','[]'::jsonb,now());
 raise exception 'FAIL: Empty publication URL accepted' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
select public.media_publish_content('50000000-0000-4000-8000-000000000002',
 '[{"platform":"Instagram","account_id":"80000000-0000-4000-8000-000000000001","url":"https://www.instagram.com/p/v181testing/"}]'::jsonb,
 now()-interval '3 minutes');
do $t$begin
 if (select status from public.media_contents where id='50000000-0000-4000-8000-000000000002')<>'Published'
 then raise exception 'Post proof and Published state did not commit';end if;
 if not exists(select 1 from public.media_publications where content_id='50000000-0000-4000-8000-000000000002'
  and format='Photo Feed Carousel' and verification_status='pending' and public_url like '%v181testing%')
 then raise exception 'Pending publication record not created';end if;
end$t$;

-- Metrics observation tied to published content, no school-crossing.
insert into public.media_metrics(publication_id,observed_at,views,likes,comments,shares)
select id,now()-interval '1 minute',100,20,4,3 from public.media_publications
where content_id='50000000-0000-4000-8000-000000000002';
update public.media_metrics set views=150,likes=25 where publication_id in
(select id from public.media_publications where content_id='50000000-0000-4000-8000-000000000002');
do $t$begin
 if (select views from public.media_metrics limit 1)<>150 then raise exception 'Metrics update failed';end if;
end$t$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $t$begin
 if (select count(*) from public.media_metrics)<>0 then raise exception 'School B read School A metrics';end if;
 begin
 insert into public.media_metrics(publication_id,views)
 select id,999999 from public.media_publications
 where content_id='50000000-0000-4000-8000-000000000002';
 -- RLS hides the source publication; if insert selects 0, confirm no rows got added.
 if (select count(*) from public.media_metrics)<>0 then raise exception 'FAIL: school B modified foreign metrics' using errcode='ZX001';end if;
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;
reset role;

-- Refuse deletion while evidence awaits a central review.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
-- Pending evidence must be reviewed before account can be archived.
do $t$begin
 begin
  update public.media_accounts set active=false where id='80000000-0000-4000-8000-000000000001';
  raise exception 'FAIL: Pending account archive allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if;end;
end$t$;

reset role;

-- The ARF Coordinator verifies school proof so it remains auditable when the account is archived.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
select public.media_verify_publication(
 (select id from public.media_publications where content_id='50000000-0000-4000-8000-000000000002'),
 'verified','');
reset role;

-- Archive records without losing Auth users or publication histories.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
update public.media_schools set active=false where id='30000000-0000-4000-8000-000000000001';
update public.media_accounts set active=false where id='80000000-0000-4000-8000-000000000001';
update public.media_targets set active=false where id='70000000-0000-4000-8000-000000000001';
do $t$begin
 if (select count(*) from public.media_publications where content_id='50000000-0000-4000-8000-000000000002')<>1
 then raise exception 'History was deleted on archive';end if;
 if (select active from public.media_targets where id='70000000-0000-4000-8000-000000000001')
 then raise exception 'Target archive did not apply';end if;
end$t$;
reset role;
\echo 'PASS: Media Hub V1.8.1 workflow, global targets, metrics, and role isolation'
