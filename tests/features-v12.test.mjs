import test from 'node:test';
import assert from 'node:assert/strict';
import {taskActiveOnDate,workloadSegments} from '../public/core.js';
import {mentionCandidates,insertMention,mentionedUserIds,formattedCommentBody} from '../public/discussion.js';
import {buildReportHTML} from '../public/reports.js';

test('Month, Week and Year calendars show work items on every date in the inclusive range',()=>{
 const item={title:'SOP Perizinan, Sakit, dan Cuti',start_date:'2026-10-22',due_date:'2026-10-26'};
 for(const day of ['22','23','24','25','26'])assert.equal(taskActiveOnDate(item,'2026-10-'+day),true);
 assert.equal(taskActiveOnDate(item,'2026-10-21'),false);
 assert.equal(taskActiveOnDate(item,'2026-10-27'),false);
 assert.equal(taskActiveOnDate({start_date:null,due_date:'2026-10-26'},'2026-10-26'),true);
 assert.equal(taskActiveOnDate({start_date:'2026-10-22',due_date:null},'2026-10-22'),true);
});
test('Workload segment counts match donut statistics',()=>{
 const items=[{status:'Not Started'},{status:'On Hold'},{status:'In Progress'},{status:'Completed'},{status:'Completed'}];
 const seg=workloadSegments(items);assert.deepEqual(seg.map(x=>x.count),[1,1,1,2]);
 assert.equal(seg.reduce((n,x)=>n+x.count,0),5);
});
test('@mention autocomplete, insertion, recipient resolution and safe markup',()=>{
 const users=[{id:'u1',username:'manager_arf',full_name:'Manager'},{id:'u2',username:'staff_arf',full_name:'Staff'}];
 assert.deepEqual(mentionCandidates('Mohon @man',10,users).map(x=>x.id),['u1']);
 const x=insertMention('Mohon @man untuk review',10,'manager_arf');
 assert.match(x.text,/@manager_arf /);
 assert.deepEqual(mentionedUserIds('Halo @manager_arf, cc @staff_arf dan @manager_arf',users),['u1','u2']);
 assert.doesNotMatch(formattedCommentBody('<script>alert(1)</script> @manager_arf'),/<script>/);
 assert.match(formattedCommentBody('@manager_arf'),/comment-mention/);
});
test('Report includes task range and escapes user content',()=>{
 const rows=[{title:'SOP <b>X</b>',start_date:'2026-10-22',due_date:'2026-10-26',status:'In Progress',priority:'High',notes:'Risk & follow up',assigned_to:'u1'}];
 const html=buildReportHTML(rows,[{id:'u1',full_name:'Staff'}],[],[],'ARF Management');
 assert.match(html,/SOP &lt;b&gt;X&lt;\/b&gt;/);
 assert.doesNotMatch(html,/<b>X<\/b>/);
 assert.match(html,/22 Okt 2026/);
 assert.match(html,/26 Okt 2026/);
 assert.match(html,/Simpan sebagai PDF/);
});
test('Demo comments notify assignee and @mentioned team members without duplicates',async()=>{
 const data=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const task=store.demo.tasks.find(t=>t.assigned_to==='u3'&&t.created_by==='u1');
 assert.ok(task);
 const c=await store.addTaskComment(task,'Please review @staff_arf',['u4']);
 assert.equal(c.task_id,task.id);
 assert.equal((await store.listTaskComments(task.id)).length,1);
 store.user={id:'u3'};
 const assigneeNotices=await store.listNotifications(task.workspace_id);
 assert.equal(assigneeNotices.length,1);
 assert.equal(assigneeNotices[0].kind,'comment');
 await store.markNotificationRead(assigneeNotices[0].id);
 assert.equal((await store.listNotifications(task.workspace_id))[0].is_read,true);
 store.user={id:'u4'};
 assert.equal((await store.listNotifications(task.workspace_id)).length,1);
 assert.equal((await store.listNotifications(task.workspace_id))[0].kind,'mention');
});
