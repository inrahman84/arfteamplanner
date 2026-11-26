\set ON_ERROR_STOP on
\echo 'Media Hub RLS / functional integration tests on ephemeral local Supabase'
-- Bootstrap via privileged DB admin, never via a client or without approved identity.
insert into public.media_schools(id,code,name,regional,level) values
('30000000-0000-4000-8000-000000000001','SCHOOL_A','Sekolah A','Regional 1','SD'),
('30000000-0000-4000-8000-000000000002','SCHOOL_B','Sekolah B','Regional 2','SMP');
insert into public.media_members(user_id,role,school_id) values
('10000000-0000-4000-8000-000000000001','ARF_MANAGER',null),
('10000000-0000-4000-8000-000000000002','ARF_MEDIA_COORDINATOR',null),
('10000000-0000-4000-8000-000000000003','SCHOOL_MEDIA_COORDINATOR','30000000-0000-4000-8000-000000000001'),
('10000000-0000-4000-8000-000000000004','SCHOOL_MEDIA_COORDINATOR','30000000-0000-4000-8000-000000000002');
insert into public.media_accounts(id,scope,school_id,platform,handle,active) values
('40000000-0000-4000-8000-000000000001','SCHOOL','30000000-0000-4000-8000-000000000001','Instagram','test_ig_a',true),
('40000000-0000-4000-8000-000000000002','SCHOOL','30000000-0000-4000-8000-000000000002','Instagram','test_ig_b',true),
('40000000-0000-4000-8000-000000000003','SCHOOL','30000000-0000-4000-8000-000000000001','TikTok','test_tt_a',true);

-- A Media-only school account can see only its assigned school.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $test$ begin
 if (select count(*) from public.media_schools)<>1 then raise exception 'School A can view another school';end if;
 if (select name from public.media_schools limit 1)<>'Sekolah A' then raise exception 'Wrong school scope';end if;
 if (select count(*) from public.media_accounts)<>2 then raise exception 'School A can see other accounts';end if;
 if not public.media_planner_blocked() then raise exception 'Media-only Planner isolation failed';end if;
 if (select public.media_role())<>'SCHOOL_MEDIA_COORDINATOR' then raise exception 'School role lookup incorrect';end if;
end $test$;
-- Insert content A with all consent/accuracy checks.
insert into public.media_contents(id,scope,school_id,title,brief,caption,created_by,
 consent_checked,copyright_checked,accuracy_checked,brand_checked,status)
values ('50000000-0000-4000-8000-000000000001','SCHOOL','30000000-0000-4000-8000-000000000001',
 'Belajar Literasi', 'Belajar bersama','Narasi aman','10000000-0000-4000-8000-000000000003',
 true,true,true,true,'Planned');

do $test$ begin
 if (select count(*) from public.media_contents)<>1 then raise exception 'School A content visibility incorrect';end if;
 begin
 insert into public.media_contents(scope,school_id,title,created_by)
 values ('SCHOOL','30000000-0000-4000-8000-000000000002','Unauthorized',
         '10000000-0000-4000-8000-000000000003');
 raise exception 'SECURITY-FAIL: cross-school content insertion allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise; end if; end;
 begin
 update public.media_contents set school_id='30000000-0000-4000-8000-000000000002'
 where id='50000000-0000-4000-8000-000000000001';
 raise exception 'SECURITY-FAIL: content reassignment allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise; end if; end;
 begin
 insert into public.workspaces(created_by,name)
 values('10000000-0000-4000-8000-000000000003','Unauthorized Planner');
 raise exception 'SECURITY-FAIL: Media-only user created Planner workspace' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise; end if; end;
end $test$;

-- Submitted is not scored until central approval; canonical URLs deduplicate queries.
insert into public.media_publications(id,content_id,school_id,platform,account_id,format,
 actual_at,public_url,verification_status)
values('60000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
 '30000000-0000-4000-8000-000000000001','Instagram',
 '40000000-0000-4000-8000-000000000001','Reels',
 now()-interval '5 minutes','https://www.instagram.com/p/unique1/?utm_source=ci','pending');
do $test$ begin
 if (select submitted_by from public.media_publications where id='60000000-0000-4000-8000-000000000001')<>'10000000-0000-4000-8000-000000000003'
 then raise exception 'Submit author not set by server';end if;
 if (select canonical_url from public.media_publications where id='60000000-0000-4000-8000-000000000001')<>'https://www.instagram.com/p/unique1'
 then raise exception 'Canonical URL normalization failed';end if;
 if (select count(*) from public.media_publications where verification_status='verified')<>0
 then raise exception 'Pending included as verified';end if;
 begin
 perform public.media_verify_publication('60000000-0000-4000-8000-000000000001','verified','');
 raise exception 'SECURITY-FAIL: school verified its own publication' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
 begin
 insert into public.media_publications(content_id,school_id,account_id,platform,public_url,actual_at,verification_status)
 values ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000002','Instagram','https://www.instagram.com/p/account-mismatch',
 now()-interval '2 minutes','pending');
 raise exception 'SECURITY-FAIL: other school media account accepted' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;
reset role;

-- Planner-only role cannot read Media Hub data even with a valid JWT.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000005',false);
do $test$ begin
 if public.media_role() is not null then raise exception 'Planner-only granted Media Hub role';end if;
 if (select count(*) from public.media_schools)<>0 then raise exception 'Planner-only sees media school';end if;
 if (select count(*) from public.media_contents)<>0 then raise exception 'Planner-only sees media content';end if;
 if (select count(*) from public.media_members)<>0 then raise exception 'Planner-only sees media membership';end if;
end $test$;
reset role;

-- School B does not inherit School A data.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
do $test$ begin
 if (select count(*) from public.media_schools)<>1 then raise exception 'School B school visibility wrong';end if;
 if (select count(*) from public.media_contents)<>0 then raise exception 'School B sees School A content';end if;
 if (select count(*) from public.media_publications)<>0 then raise exception 'School B sees School A proof';end if;
end $test$;
reset role;

-- Central verifier can view both schools and verify a school-submitted proof.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $test$ begin
 if (select count(*) from public.media_schools)<>2 then raise exception 'Central cannot see all schools';end if;
 if (select count(*) from public.media_contents)<>1 then raise exception 'Central content visibility wrong';end if;
end $test$;
-- Direct mutations cannot bypass reviewed, audited RPC paths.
do $test$ begin
 begin
 update public.media_publications set verification_status='verified'
 where id='60000000-0000-4000-8000-000000000001';
 raise exception 'SECURITY-FAIL: direct verification bypassed audited RPC' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
 begin
 insert into public.media_reviews(content_id,content_version,decision,feedback,reviewer_id)
 values('50000000-0000-4000-8000-000000000001',1,'feedback','forged','10000000-0000-4000-8000-000000000002');
 raise exception 'SECURITY-FAIL: direct review forged' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;
select public.media_verify_publication('60000000-0000-4000-8000-000000000001','verified','');
do $test$ begin
 if (select count(*) from public.media_publications where verification_status='verified')<>1
 then raise exception 'Publication verification not persisted';end if;
 begin
 update public.media_publications set verification_status='pending'
 where id='60000000-0000-4000-8000-000000000001';
 raise exception 'SECURITY-FAIL: verified publication tampered' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;
reset role;

-- Manager can read both, cannot deactivate final Manager.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
do $test$ begin
 if (select count(*) from public.media_schools)<>2 then raise exception 'Manager school scope wrong';end if;
 if public.media_planner_blocked() then raise exception 'Existing Planner member unexpectedly blocked';end if;
 -- Manager may not forge an approval by PATCH; must use audited review RPC.
 begin
   update public.media_contents set strategic=true,status='In Review',
     review_status='approved' where id='50000000-0000-4000-8000-000000000001';
   raise exception 'SECURITY-FAIL: direct content approval bypassed audited RPC' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
 begin
 update public.media_members set active=false
 where user_id='10000000-0000-4000-8000-000000000001';
 raise exception 'SECURITY-FAIL: last Manager deactivated' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;
-- Audit-controlled Manager approval must work and create immutable review history.
update public.media_contents set strategic=true,status='In Review'
where id='50000000-0000-4000-8000-000000000001';
select public.media_review_content('50000000-0000-4000-8000-000000000001','approved','Approved for publication');
do $test$ begin
 if (select review_status from public.media_contents where id='50000000-0000-4000-8000-000000000001')<>'approved'
 then raise exception 'Manager review RPC failed';end if;
 if (select count(*) from public.media_audit_logs where action='review_approved')<>1
 then raise exception 'Manager approval did not write audit';end if;
end $test$;
reset role;

-- Server-side duplicate URL protection with different query string.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
do $test$ begin
 begin
 insert into public.media_publications(content_id,school_id,account_id,platform,public_url,actual_at,verification_status)
 values('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001',
 '40000000-0000-4000-8000-000000000001','Instagram',
 'https://www.instagram.com/p/unique1/?utm_campaign=other',now()-interval '2 minutes','pending');
 raise exception 'SECURITY-FAIL: duplicate post counted twice' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;
reset role;


-- Media-only Planner entitlement must be enforced even for privileged inserts:
-- no caller or trusted Admin may silently add the school user to Planner.
do $test$ begin
 begin
 insert into public.workspace_members(workspace_id,user_id,role)
 values('20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000003','officer');
 raise exception 'SECURITY-FAIL: privileged invite bypassed Media-only restriction' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;

-- Central roles can verify via controlled RPCs; cannot directly invent audit logs.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
do $test$ begin
 begin
 insert into public.media_audit_logs(actor_id,action,entity,detail)
 values('10000000-0000-4000-8000-000000000002','fake_verified','media_publications','{}');
 raise exception 'SECURITY-FAIL: central user forged an audit event' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
 if (select count(*) from public.media_audit_logs where action='verified')<>1
 then raise exception 'Real verified RPC did not write audit event';end if;
end $test$;
reset role;

-- Only the Manager may withdraw a verified publication; the audit is preserved.
set role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
select public.media_withdraw_publication('60000000-0000-4000-8000-000000000001',
 'Permission withdrawn by child guardian');
do $test$ begin
 if (select count(*) from public.media_publications where verification_status='withdrawn')<>1
 then raise exception 'Manager withdrawal did not persist';end if;
 if (select count(*) from public.media_audit_logs where action='withdraw_verified_publication')<>1
 then raise exception 'Manager withdrawal audit not written';end if;
end $test$;
reset role;

-- Targets may not be backdated nor overlap for same school and platform.
insert into public.media_targets(school_id,platform,quota,effective_from)
values('30000000-0000-4000-8000-000000000001','TikTok',2,
date_trunc('week',(now() at time zone 'Asia/Pontianak'))::date);
do $test$ begin
 begin
 insert into public.media_targets(school_id,platform,quota,effective_from)
 values('30000000-0000-4000-8000-000000000001','TikTok',3,
 date_trunc('week',(now() at time zone 'Asia/Pontianak'))::date+interval '7 days');
 raise exception 'SECURITY-FAIL: overlapping target windows allowed' using errcode='ZX001';
 exception when others then if sqlstate='ZX001' then raise;end if; end;
end $test$;

-- All table-level RLS must be active; anon must not have read permission.
do $test$
declare name text;
begin
 foreach name in array array['media_schools','media_members','media_accounts','media_categories',
 'media_targets','media_contents','media_publications','media_reviews','media_audit_logs'] loop
  if not (select relrowsecurity from pg_class where oid=('public.'||name)::regclass) then
    raise exception 'RLS not enabled: %',name;end if;
  if has_table_privilege('anon','public.'||name,'SELECT') then
    raise exception 'Anonymous access unexpectedly enabled: %',name;end if;
 end loop;
end $test$;
\echo 'PASS: Ephemeral Supabase Media Hub migration and role matrix'
