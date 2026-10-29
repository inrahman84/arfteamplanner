import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../public/store.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/012_delete_workspace.sql',import.meta.url),'utf8');

test('Assigned By filters work items independently from Assigned To',()=>{
 const match=app.match(/function filteredTasks\(\)\{[\s\S]*?\n\}/);
 assert.ok(match,'filteredTasks implementation not found');
 const S={tasks:[
  {id:'1',status:'In Progress',assigned_to:'u2',assigned_by:'u1',title:'Alpha'},
  {id:'2',status:'In Progress',assigned_to:'u2',assigned_by:'u3',title:'Beta'},
  {id:'3',status:'Completed',assigned_to:'u4',assigned_by:'u1',title:'Gamma'}
 ],search:''};
 let current={status:'',priority:'',category:'',project:'',assignee:'',assigned_by:'u1'};
 const fn=new Function('S','taskFilter','selectedProjectIds','inProject','nameOf','projectNames','categoryOf',match[0]+';return filteredTasks;')(
  S,()=>current,()=>null,()=>true,id=>id,()=>[],()=>null);
 assert.deepEqual(fn().map(t=>t.id),['1','3']);
 current={...current,assignee:'u2'};
 assert.deepEqual(fn().map(t=>t.id),['1']);
 current={...current,assigned_by:'u3'};
 assert.deepEqual(fn().map(t=>t.id),['2']);
});

test('Archived Work Item detail is opened read-only',()=>{
 assert.match(app,/data-action="view-archived-task"/);
 assert.match(app,/archivedTask:\{title:'Archived Work Item Details'/);
 assert.match(app,/const canEditTask=t=>!t\?\.archived_at/);
 assert.match(app,/\['task','archivedTask'\]\.includes\(S\.modal\)/);
 assert.match(app,/id="commentForm" \$\{t\.archived_at\?'hidden'/);
});

test('Board cards scroll below a non-scrolling header',()=>{
 assert.match(app,/class="kanban-items"/);
 const zone=css.slice(css.lastIndexOf('V1.7.6 — isolate Kanban'));
 assert.match(zone,/\.kanban-items\s*\{[^}]*overflow-y:auto/s);
 assert.match(zone,/\.kanban-col \.col-top\s*\{[^}]*position:relative/s);
 assert.match(zone,/\.kanban-col\s*\{[^}]*overflow:hidden/s);
});

test('Only owner can delete a Workspace in demo mode and other Workspace data survives',async()=>{
 const from=store.indexOf(' async deleteWorkspace(workspaceId,confirmationName){');
 const to=store.indexOf(' async joinWorkspace(',from);
 assert.ok(from>0&&to>from);
 const LocalStore=new Function('return class LocalStore {'+store.slice(from,to)+'}')();
 const o=new LocalStore();
 o.user={id:'u1'};o.connected=false;
 o.demo={
  workspaces:[{id:'w1',name:'Workspace One',created_by:'u1'},{id:'w2',name:'Workspace Two',created_by:'u2'}],
  members:[{workspace_id:'w1',user_id:'u1',role:'super_admin'},{workspace_id:'w2',user_id:'u2',role:'super_admin'}],
  tasks:[{workspace_id:'w1',id:'t1'},{workspace_id:'w2',id:'t2'}],
  projects:[{workspace_id:'w1',id:'p1'},{workspace_id:'w2',id:'p2'}],
  categories:[],comments:[],notifications:[],checklist:[],dueDateRequests:[],
  workloadPositions:[],dashboardPositions:[],projectTaskPositions:[],managementPositions:[],viewPreferences:[]
 };
 o.listWorkspaces=async()=>o.demo.workspaces;o.saveDemo=()=>{};
 await assert.rejects(o.deleteWorkspace('w2','Workspace Two'),/Only the Workspace creator/);
 assert.equal(o.demo.tasks.length,2);
 await assert.rejects(o.deleteWorkspace('w1','wrong name'),/confirmation does not match/);
 await o.deleteWorkspace('w1','Workspace One');
 assert.deepEqual(o.demo.workspaces.map(w=>w.id),['w2']);
 assert.deepEqual(o.demo.tasks.map(t=>t.id),['t2']);
 assert.deepEqual(o.demo.projects.map(p=>p.id),['p2']);
 assert.deepEqual(o.demo.members.map(m=>m.workspace_id),['w2']);
});

test('Database Workspace DELETE policy restricts creator and Super Admin',()=>{
 assert.match(sql,/created_by\s*=\s*\(select auth\.uid\(\)\)/);
 assert.match(sql,/has_workspace_role\(id,\s*array\['super_admin'\]\)/);
 assert.match(app,/case 'delete-workspace'/);
 assert.match(app,/typed!==w\.name/);
});
