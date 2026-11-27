import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mediaWeeklyScore} from '../public/media-utils.js';
const ui=readFileSync(new URL('../public/media-hub.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/021_media_hub_v181_workflows.sql',import.meta.url),'utf8');

test('global weekly target applies to every school and inactive global target falls back to 2',()=>{
 const t=[{school_id:null,platform:'Instagram',quota:4,effective_from:'2026-11-23',active:true},
 {school_id:null,platform:'TikTok',quota:3,effective_from:'2026-11-23',active:true}];
 const a=mediaWeeklyScore('school-a','2026-11-23',[],t);
 const b=mediaWeeklyScore('school-b','2026-11-23',[],t);
 assert.equal(a.quotaIG,4);
 assert.equal(a.quotaTT,3);
 assert.equal(b.quotaIG,4);
 assert.equal(b.quotaTT,3);
 t[0].active=false;
 assert.equal(mediaWeeklyScore('school-a','2026-11-23',[],t).quotaIG,2);
});
test('global target wins against any legacy school-level target',()=>{
 const t=[{school_id:'school-a',platform:'Instagram',quota:9,effective_from:'2026-11-23',active:true},
 {school_id:null,platform:'Instagram',quota:3,effective_from:'2026-11-23',active:true}];
 assert.equal(mediaWeeklyScore('school-a','2026-11-23',[],t).quotaIG,3);
});
test('content form supports all three requested formats, approved review and mandatory published links',()=>{
 for(const status of ['Planned','In Production','In Review','Revision','Approved','Scheduled','Published'])
  assert.ok(ui.includes("'"+status+"'"),status);
 for(const format of ['Video Reels','Photo Feed Tunggal','Photo Feed Carousel'])
  assert.ok(ui.includes(format),format);
 for(const term of ['publish_account_id','publish_url','publish_actual_at','media_publish_content',
  'mh-revision-form','content-approve','content-revision'])
  assert.ok(ui.includes(term),term);
 assert.ok(sql.includes("status=case when p_decision='approved' then 'Scheduled'"));
 assert.ok(sql.includes('Revision feedback required'));
 assert.ok(sql.includes('Content must be approved and scheduled before publishing'));
});
test('edit and soft removal actions and metrics form are exposed; Handle not in account form',()=>{
 for(const action of ['school-edit','school-toggle','account-edit','account-toggle',
 'target-edit','target-toggle','member-edit','member-toggle','metric-edit',
 'mh-metrics-form','media_metrics'])
  assert.ok(ui.includes(action),action);
 assert.ok(!/input\('Handle'/.test(ui));
 assert.ok(!/select\('Sekolah','school_id',[^\n]*\+\s*select\('Platform','platform',[^\n]*\+\s*input\('Handle'/.test(ui));
 assert.ok(sql.includes('public.media_metrics enable row level security'));
 assert.ok(sql.includes('alter column school_id drop not null'));
});
