import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediaWeekStart,mediaPeriodFor,mediaWeeklyScore,mediaRoleLabel} from '../public/media-utils.js';

const app=readFileSync(new URL('../public/media-hub.js',import.meta.url),'utf8');
const planner=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/019_media_hub_p0.sql',import.meta.url),'utf8');
const edge=readFileSync(new URL('../supabase/functions/media-school-accounts/handler.mjs',import.meta.url),'utf8');
const edgeEntry=readFileSync(new URL('../supabase/functions/media-school-accounts/index.ts',import.meta.url),'utf8');
const week='2026-11-23';
const stamp=(d,h)=>new Date(d+'T'+h+':00+07:00').toISOString();
const p=(platform,status,day='2026-11-25',hour='10:00',school='s1')=>({
 school_id:school,platform,verification_status:status,actual_at:stamp(day,hour)
});
test('WIB Monday boundary allocates Sunday 23:59 and Monday 00:00 to different weeks',()=>{
 assert.equal(mediaWeekStart('2026-11-26'),week);
 assert.equal(mediaWeekStart(new Date('2026-11-29T16:59:00Z')),week);
 assert.equal(mediaWeekStart(new Date('2026-11-29T17:00:00Z')),'2026-11-30');
 assert.equal(mediaWeekStart('2027-01-01'),'2026-12-28');
 assert.equal(mediaPeriodFor('2026-11-29T16:59:00Z'),'2026-11-29T23:59');
});
test('Weekly target compliance uses verified only; 3 IG + 1 TikTok => 75% and no overcompensation',()=>{
 const publications=[p('Instagram','verified'),p('Instagram','verified'),p('Instagram','verified'),
 p('TikTok','verified'),p('TikTok','pending'),p('Instagram','rejected')];
 const row=mediaWeeklyScore('s1',week,publications,[]);
 assert.equal(row.score,75);
 assert.deepEqual([row.ig,row.tt,row.pending,row.neededIG,row.neededTT],[3,1,1,0,1]);
 const fixed=mediaWeeklyScore('s1',week,[...publications,p('TikTok','verified')],[]);
 assert.equal(fixed.score,100);
 const surplus=mediaWeeklyScore('s1',week,Array.from({length:4},()=>p('Instagram','verified')),[]);
 assert.equal(surplus.score,50);
});
test('No post / no active targets / prospective target setting follow exact score semantics',()=>{
 assert.equal(mediaWeeklyScore('s1',week,[],[]).score,0);
 const zero=[{school_id:'s1',platform:'Instagram',quota:0,effective_from:'2026-11-01'},
 {school_id:'s1',platform:'TikTok',quota:0,effective_from:'2026-11-01'}];
 assert.equal(mediaWeeklyScore('s1',week,[],zero).score,null);
 assert.equal(mediaWeeklyScore('s1',week,[],zero).eligible,false);
 const future=[{school_id:'s1',platform:'Instagram',quota:0,effective_from:'2026-11-30'}];
 assert.equal(mediaWeeklyScore('s1',week,[],future).quotaIG,2);
 assert.equal(mediaWeeklyScore('s1','2026-11-30',[],future).quotaIG,0);
});
test('Weekly scores do not count other schools, other weeks or unverified posts',()=>{
 const other=[p('Instagram','verified','2026-11-26','10:00','s2'),
 p('TikTok','verified','2026-12-01'),p('Instagram','pending'),p('Instagram','withdrawn')];
 const row=mediaWeeklyScore('s1',week,other,[]);
 assert.deepEqual([row.ig,row.tt,row.pending,row.score],[0,0,1,0]);
});
test('Media Hub has nine finalized menus and independent Planner navigation',()=>{
 const menus=['Dashboard','Content Workspace','Content Calendar','Content Table',
  'Published Content','Review & Feedback','Performance Analytics','Administration','User & Role Management'];
 for(const name of menus)assert.ok(app.includes("'"+name+"'"),name);
 assert.ok(planner.includes('mediaMembership'));
 assert.ok(planner.includes('/media-hub.html'));
 assert.ok(planner.includes("'next')==='media-hub'"));
 assert.ok(app.includes('store.initialize()'));
 assert.ok(app.includes("media_members','GET'"));
 assert.ok(app.includes("media_contents','GET'"));
 assert.ok(app.includes("media_publications','GET'"));
 assert.doesNotMatch(app,/YouTube|youtube\.com/i);
});
test('Only Verified posts count; review, publication proof and password provision actions present',()=>{
 for(const name of ['media_review_content','media_verify_publication','media-school-accounts',
 'mh-content-form','mh-publication-form','mh-school-account-form','mediaWeeklyScore','SCHOOL_MEDIA_COORDINATOR'])
  assert.ok(app.includes(name),name);
 assert.ok(sql.includes('Self verification is prohibited'));
 assert.ok(sql.includes('Verified publication cannot be edited'));
 assert.ok(sql.includes('Cannot deactivate the final ARF Media Hub Manager'));
 assert.ok(sql.includes('Only Manager can downgrade strategic content'));
 assert.ok(sql.includes('public.media_can_read_school'));
 assert.ok(sql.includes("auth.uid()"));
 assert.ok(!edge.includes('console.log(password)'));
 assert.ok(!edge.includes('workspace_members'));
 assert.ok(edgeEntry.includes('Deno.serve(handleRequest)'));
 assert.ok(edge.includes('/rest/v1/arf_school_members'));
 assert.ok(edge.includes('planner_enabled:false'));
});
test('Media domain tables are independent, guarded by RLS and do not grant Planner privileges',()=>{
 for(const name of ['media_schools','media_members','media_accounts','media_targets','media_contents',
  'media_publications','media_reviews','media_audit_logs','media_categories'])
  assert.match(sql,new RegExp('alter table public\\.'+name+' enable row level security'));
 assert.match(sql,/media_members for select to authenticated/);
 assert.match(sql,/media_can_read_school\(school_id\)/);
 assert.match(sql,/grant execute on function public\.media_verify_publication/);
 assert.doesNotMatch(sql,/insert into public\.workspace_members/);
 assert.doesNotMatch(sql,/insert into public\.media_members[\s\S]*?select.*from public\.workspace_members/i);
 assert.ok(edge.includes('email_confirm:true'));
 assert.ok(edge.includes("role:'SCHOOL_MEDIA_COORDINATOR'"));
 assert.ok(edge.includes('@arf-media.internal'));
 assert.ok(!edge.includes('service_role')||edge.includes("SUPABASE_SERVICE_ROLE_KEY"));
});

test('Media Hub form inputs do not accidentally trigger modal backdrop close',()=>{
 assert.match(app,/button\.classList\.contains\('mh-modal-shade'\)\&\&e\.target!==button/);
 assert.match(app,/e\.preventDefault\(\);busy\(\(\)=>handleAction/);
});
test('Content must have checked privacy and brand fields before review or submission',()=>{
 for(const field of ['consent_checked','copyright_checked','accuracy_checked','brand_checked']){
  assert.ok(app.includes(field),field);
  assert.ok(sql.includes(field),field);
 }
 assert.ok(sql.includes('Content checklist incomplete; submission blocked'));
 assert.ok(sql.includes('Consent, copyright, accuracy and brand checklist must be complete'));
 assert.ok(sql.includes('media_planner_blocked'));
 assert.ok(sql.includes('planner_enabled'));
});
