import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {projectIds,projectProgress,csvExport} from '../public/core.js';
import {filterPlannerReport} from '../public/pdf-report.js';

test('multi-Project membership and portfolio progress count unique Work Items once',()=>{
 const projects=[{id:'p1',name:'Literacy',color:'#073b2d'},{id:'p2',name:'Teacher Development',color:'#009b4c'}];
 const tasks=[
  {id:'t1',project_id:'p1',project_ids:['p1','p2'],status:'Completed',title:'A'},
  {id:'t2',project_id:'p1',project_ids:['p1'],status:'In Progress',title:'B'},
  {id:'t3',project_id:'p2',project_ids:['p2'],status:'Completed',title:'C'},
  {id:'t4',project_id:null,project_ids:[],status:'Not Started',title:'D'}
 ];
 assert.deepEqual(projectIds({project_id:'p1',project_ids:[]}),['p1']);
 assert.deepEqual(projectIds({project_id:'p1',project_ids:['p1','p2','p2']}),['p1','p2']);
 const progress=projectProgress(tasks,projects);
 assert.deepEqual(progress.projects.map(p=>[p.id,p.total,p.completed,p.percent]),[['p1',2,1,50],['p2',2,2,100]]);
 assert.deepEqual([progress.total,progress.completed,progress.percent],[3,2,67]);
 assert.deepEqual(filterPlannerReport(tasks,{scope:'project',id:'p2'}).map(t=>t.id),['t1','t3']);
 const csv=csvExport(tasks,[],[],projects);
 assert.ok(csv.includes('Literacy ; Teacher Development'));
});

test('demo saving, archived Project interactions and deleting one association preserve other Projects',async()=>{
 const memory=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id,oldTaskCount=store.demo.tasks.length;
 const first=await store.createProject({workspace_id:ws,name:'Programme A',color:'#073b2d'});
 const second=await store.createProject({workspace_id:ws,name:'Programme B',color:'#009b4c'});
 const task=await store.saveTask({workspace_id:ws,project_ids:[first.id,second.id],project_id:first.id,title:'Multiple programmes',created_by:store.user.id,assigned_to:store.user.id,status:'Not Started',priority:'Medium',attachment_urls:[]});
 assert.deepEqual(projectIds(task),[first.id,second.id]);
 await store.archiveProject(ws,first.id);
 assert.ok((await store.loadWorkspace(ws)).tasks.some(t=>t.id===task.id),'still visible via second active Project');
 await store.archiveProject(ws,second.id);
 assert.ok(!(await store.loadWorkspace(ws)).tasks.some(t=>t.id===task.id),'hidden when all projects archived');
 await store.archiveProject(ws,first.id,true);
 assert.ok((await store.loadWorkspace(ws)).tasks.some(t=>t.id===task.id),'restored when one linked Project is active');
 await store.archiveProject(ws,first.id);
 await store.deleteArchivedProject(ws,first.id);
 assert.deepEqual(projectIds(store.demo.tasks.find(t=>t.id===task.id)),[second.id]);
 assert.equal(store.demo.tasks.length,oldTaskCount+1);
});

test('Project list, multi-select task form and dashboard show requested UI',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 const migration=await readFile(new URL('../sql/013_multi_project_work_items.sql',import.meta.url),'utf8');
 for(const marker of ['project-management-list','name="project_ids"','data-filter="project"','Project Performance','Overall Project Achievement','projectProgress(source,visibleProjects)','function groupTasksByProject']) assert.ok(app.includes(marker),marker);
 assert.match(css,/\.portfolio-donut/);
 assert.match(css,/\.project-check/);
 assert.match(migration,/create trigger sync_task_project_ids/);
 assert.match(migration,/create trigger cleanup_deleted_task_project/);
 assert.match(migration,/Maximum 20 Projects per Work Item/);
});
