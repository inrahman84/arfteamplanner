import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('New Task accepts a draft checklist and saves it with the Work Item',async()=>{
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id,prior=store.demo.tasks.length;
 const task=await store.saveNewTaskWithChecklist({
  workspace_id:ws,title:'New Task with pre-save checklist',assigned_to:store.user.id,status:'Not Started',priority:'High',
  start_date:'2026-10-23',due_date:'2026-10-29',notes:'',stakeholders:'',attachment_urls:[]
 },[{title:'Prepare draft',is_done:false},{title:'Send for review',is_done:true}]);
 assert.ok(task.id);
 assert.equal(store.demo.tasks.length,prior+1);
 const items=await store.listTaskChecklist(task.id);
 assert.deepEqual(items.map(x=>({title:x.title,is_done:x.is_done})),[
  {title:'Prepare draft',is_done:false},{title:'Send for review',is_done:true}
 ]);
 await assert.rejects(()=>store.saveNewTaskWithChecklist({
  workspace_id:ws,title:'Invalid checklist',assigned_to:store.user.id,status:'Not Started',priority:'Low',
  attachment_urls:[]
 },[{title:''}]),/Checklist/);
 assert.equal(store.demo.tasks.length,prior+1);
});

test('Dashboard KPI and panel card orders persist without overwriting each other',async()=>{
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 await store.saveDashboardOrder(ws,['overdue','completed','progress','total','hold','pending']);
 await store.saveDashboardOrder(ws,['workload','calendar','approvals','deadlines']);
 const loaded=await store.loadWorkspace(ws);
 const order=keys=>loaded.dashboardPositions.filter(x=>keys.includes(x.card_key)).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.card_key);
 assert.deepEqual(order(['total','progress','hold','completed','pending','overdue']),['overdue','completed','progress','total','hold','pending']);
 assert.deepEqual(order(['calendar','deadlines','workload','approvals']),['workload','calendar','approvals','deadlines']);
 await assert.rejects(()=>store.saveDashboardOrder(ws,['total','total']),/tidak valid/i);
 await assert.rejects(()=>store.saveDashboardOrder(ws,['unknown']),/tidak valid/i);
});

test('Views do not share assignee filtering and project hierarchy remains explicit',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const sql=await readFile(new URL('../sql/009_create_task_with_draft_checklist.sql',import.meta.url),'utf8');
 assert.match(app,/function taskFilter\(\)/);
 assert.match(app,/viewFilters:\{\}/);
 assert.match(app,/assignee:store\.user\?\.id\|\|''/);
 assert.match(app,/const data=scopeTasks\(S\.tasks,'dashboard'\)/);
 assert.match(app,/case 'new-task'[\s\S]*?assigned_to:store\.user\?\.id/);
 assert.match(app,/function groupTasksByProject/);
 assert.match(app,/class="project-group-row"/);
 assert.match(app,/class="gantt-project-heading"/);
 assert.match(app,/function applyDashboardLayout/);
 assert.match(app,/draggingDashboardKey/);
 assert.match(app,/S\.draftChecklist/);
 assert.match(app,/saveNewTaskWithChecklist\(task,S\.draftChecklist\)/);
 assert.match(sql,/security invoker/i);
 assert.match(sql,/insert into public\.tasks/);
 assert.match(sql,/insert into public\.task_checklist/);
});

test('Dashboard card database rules restrict read/write to own user and workspace',async()=>{
 const sql=await readFile(new URL('../sql/008_dashboard_card_positions_v15.sql',import.meta.url),'utf8');
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/user_id=\(select auth\.uid\(\)\)/);
 assert.match(sql,/is_workspace_member\(workspace_id\)/);
 assert.doesNotMatch(sql,/security definer/i);
});
