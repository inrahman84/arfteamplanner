import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediaMonthMondays,mediaMonthlyScore,mediaWeeklyScore} from '../public/media-utils.js';
const ui=readFileSync(new URL('../public/media-hub.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/022_media_hub_v182_coordinator_access.sql',import.meta.url),'utf8');

test('Monthly targets are the accumulated effective Monday-week quotas, Verified only',()=>{
 const mondays=mediaMonthMondays('2026-11');
 assert.deepEqual(mondays,['2026-11-02','2026-11-09','2026-11-16','2026-11-23','2026-11-30']);
 const targets=[
  {school_id:null,platform:'Instagram',quota:2,effective_from:'2026-10-26',active:true},
  {school_id:null,platform:'TikTok',quota:3,effective_from:'2026-10-26',active:true}
 ];
 const posts=[
  {school_id:'A',platform:'Instagram',actual_at:'2026-11-02T10:00:00+07:00',verification_status:'verified'},
  {school_id:'A',platform:'Instagram',actual_at:'2026-11-30T12:00:00+07:00',verification_status:'verified'},
  {school_id:'A',platform:'Instagram',actual_at:'2026-12-01T12:00:00+07:00',verification_status:'verified'},
  {school_id:'A',platform:'TikTok',actual_at:'2026-11-13T12:00:00+07:00',verification_status:'pending'},
  {school_id:'A',platform:'TikTok',actual_at:'2026-11-15T12:00:00+07:00',verification_status:'verified'}
 ];
 const result=mediaMonthlyScore('A','2026-11',posts,targets);
 assert.equal(result.weeks,5);
 assert.equal(result.quotaIG,10);assert.equal(result.quotaTT,15);
 assert.equal(result.ig,3);assert.equal(result.tt,1);
 assert.equal(result.pending,1);assert.equal(result.score,18);
 assert.equal(mediaMonthlyScore('B','2026-11',posts,targets).ig,0);
 assert.equal(mediaWeekStartCheck('2026-12-01'), '2026-11-30');
});
function mediaWeekStartCheck(day){return new Date(day+'T00:00:00Z').getUTCDay()===1?day:mediaWeekLabel(day);}
function mediaWeekLabel(day){const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);}

test('Annual boundary, months with four or five Mondays and zero quota',()=>{
 assert.equal(mediaMonthMondays('2027-02').length,4);
 assert.throws(()=>mediaMonthMondays('2027-13'));
 const r=mediaMonthlyScore('A','2026-11',[],[
  {school_id:null,platform:'Instagram',quota:0,effective_from:'2026-01-01',active:true},
  {school_id:null,platform:'TikTok',quota:0,effective_from:'2026-01-01',active:true}
 ]);
 assert.equal(r.score,null);assert.equal(r.eligible,false);
 assert.equal(mediaWeeklyScore('A','2026-11-23',[],[]).quotaIG,2);
});

test('Scope and creator/PIC filter belongs to five requested views',()=>{
 for(const name of ['Content Workspace','Content Calendar','Content Table','Published Content','Performance Analytics'])
  assert.ok(ui.includes("'"+name+"'"),name);
 for(const term of ["filter_scope","filter_user","Cakupan:","Sekolah/Institusi",
   'Capaian Target Bulanan','Capaian Target Mingguan',
   'mediaMonthlyScore','monthlyScores','publishedRecords','contentMatches'])
  assert.ok(ui.includes(term),term);
 assert.ok(ui.includes("c.created_by!==M.userFilter&&c.assigned_to!==M.userFilter"));
});

test('School coordinator sees own school name in read-only content scope',()=>{
 assert.ok(ui.includes("text(schoolName(userSchool()))"));
 assert.ok(ui.includes('readonly aria-label="Cakupan sekolah"'));
 assert.ok(ui.includes('name="scope" value="SCHOOL"'));
});
test('User Role Management has name/username edits, coordinator privileges and protected Manager password',()=>{
 for(const term of ["mh-member-form","mh-password-form","full_name","username",
  "action:'update'","action:'reset'","mh-permission-cell","Memerlukan Izin","Sekolah/Institusi"])
  assert.ok(ui.includes(term),term);
 assert.ok(sql.includes('public.media_is_central()'));
 assert.ok(sql.includes('media_member_central_update'));
 assert.ok(sql.includes("revoke all on function public.media_guard_member_entitlements()"));
});
