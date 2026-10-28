import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function demo(){
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 return storage;
}

test('Project ordering saves per Project and survives reload without modifying task statuses',async()=>{
 demo();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 const project=store.demo.projects.find(p=>p.workspace_id===ws);
 const extra=await store.createProject({workspace_id:ws,name:'Reorder Project',color:'#073b2d'});
 const originals=store.demo.tasks.filter(t=>t.workspace_id===ws);
 const t1=await store.saveTask({workspace_id:ws,project_ids:[project.id,extra.id],title:'Sort alpha',created_by:store.user.id,assigned_to:store.user.id,status:'Not Started',priority:'Medium',attachment_urls:[]});
 const t2=await store.saveTask({workspace_id:ws,project_ids:[project.id,extra.id],title:'Sort beta',created_by:store.user.id,assigned_to:store.user.id,status:'In Progress',priority:'Medium',attachment_urls:[]});
 const count=store.demo.tasks.length;
 const positions=await store.saveProjectTaskOrder(ws,extra.id,[t2.id,t1.id]);
 assert.deepEqual(positions.map(p=>p.task_id),[t2.id,t1.id]);
 assert.deepEqual((await store.loadWorkspace(ws)).projectTaskPositions.filter(p=>p.project_id===extra.id).sort((a,b)=>a.sort_order-b.sort_order).map(p=>p.task_id),[t2.id,t1.id]);
 await store.initialize();
 assert.deepEqual((await store.loadWorkspace(ws)).projectTaskPositions.filter(p=>p.project_id===extra.id).sort((a,b)=>a.sort_order-b.sort_order).map(p=>p.task_id),[t2.id,t1.id]);
 assert.equal(store.demo.tasks.length,count);
 assert.equal(store.demo.tasks.find(t=>t.id===t1.id).status,'Not Started');
 assert.equal(store.demo.tasks.find(t=>t.id===t2.id).status,'In Progress');
 assert.equal(originals.length+2,count);
 await assert.rejects(()=>store.saveProjectTaskOrder(ws,extra.id,[t1.id,t1.id]),/tidak valid/);
 await assert.rejects(()=>store.saveProjectTaskOrder(ws,'unknown',[t1.id]),/tidak diizinkan/);
});

test('Editing a Category changes name and color without resetting Work Item links',async()=>{
 demo();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 const item=store.demo.categories.find(c=>c.workspace_id===ws);
 const before=store.demo.tasks.filter(t=>t.category_id===item.id).map(t=>t.id);
 const edited=await store.updateCategory(ws,item.id,{name:'Updated Category',color:'#009b4c'});
 assert.equal(edited.name,'Updated Category');
 assert.equal(edited.color,'#009b4c');
 assert.deepEqual(store.demo.tasks.filter(t=>t.category_id===item.id).map(t=>t.id),before);
 await assert.rejects(()=>store.updateCategory(ws,item.id,{name:'',color:'#009b4c'}),/2–80/);
 await assert.rejects(()=>store.updateCategory(ws,item.id,{name:'Good',color:'not-a-color'}),/tidak valid/);
});

test('UI keeps Project input aligned and shared ordering in Grid/Gantt',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 const store=await readFile(new URL('../public/store.js',import.meta.url),'utf8');
 const migration=await readFile(new URL('../sql/014_project_task_order.sql',import.meta.url),'utf8');
 for(const key of ['category-management-list','edit-category','editCategoryForm','sortProjectWorkItems','data-grid-grip','grid-row-target','saveProjectTaskOrder'])assert.ok(app.includes(key),key);
 assert.match(app,/return \[\.\.\.groups\.values\(\)\]\.map\(g=>\(\{\.\.\.g,items:sortProjectWorkItems\(g\.items,g\.id\)\}\)\)/);
 assert.match(app,/groupTasksByProject\(data\)/g);
 assert.match(css,/\.multi-project-picker>label\.project-check/);
 assert.match(css,/grid-template-columns:18px 12px minmax\(0,1fr\)/);
 assert.match(css,/\.grid-order-grip/);
 assert.match(store,/projectTaskPositions/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/create policy project_task_positions_update/);
 assert.match(migration,/primary key\(project_id,task_id\)/);
});
