import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function demo(){
 const state=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:key=>state.get(key)||null,setItem:(key,value)=>state.set(key,value),removeItem:key=>state.delete(key)};
 return state;
}

test('Settings Projects and Categories save independent shared orders across reloads',async()=>{
 demo();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const workspace=store.demo.workspaces[0].id;
 const p1=await store.createProject({workspace_id:workspace,name:'Project V173 A',color:'#073b2d'});
 const p2=await store.createProject({workspace_id:workspace,name:'Project V173 B',color:'#009b4c'});
 const c1=await store.createCategory({workspace_id:workspace,name:'Category V173 A',color:'#3f6276'});
 const c2=await store.createCategory({workspace_id:workspace,name:'Category V173 B',color:'#c89b55'});
 const taskCount=store.demo.tasks.length;
 let saved=await store.saveManagementItemOrder(workspace,'project',[p2.id,p1.id]);
 assert.deepEqual(saved.map(x=>x.item_id),[p2.id,p1.id]);
 saved=await store.saveManagementItemOrder(workspace,'category',[c2.id,c1.id]);
 assert.deepEqual(saved.map(x=>x.item_id),[c2.id,c1.id]);
 const positions=(await store.loadWorkspace(workspace)).managementPositions;
 assert.deepEqual(positions.filter(x=>x.item_type==='project'&&[p1.id,p2.id].includes(x.item_id)).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.item_id),[p2.id,p1.id]);
 assert.deepEqual(positions.filter(x=>x.item_type==='category'&&[c1.id,c2.id].includes(x.item_id)).sort((a,b)=>a.sort_order-b.sort_order).map(x=>x.item_id),[c2.id,c1.id]);
 await store.initialize();
 assert.equal((await store.loadWorkspace(workspace)).managementPositions.length>=4,true);
 assert.equal(store.demo.tasks.length,taskCount,'sorting must not mutate Work Items');
 const different=await store.createWorkspace('Other Workspace V173');
 assert.deepEqual((await store.loadWorkspace(different.id)).managementPositions,[]);
 await assert.rejects(()=>store.saveManagementItemOrder(workspace,'unknown',[p1.id]),/Jenis urutan/);
 await assert.rejects(()=>store.saveManagementItemOrder(workspace,'project',[p1.id,p1.id]),/Daftar urutan/);
 await assert.rejects(()=>store.saveManagementItemOrder(workspace,'project',[c1.id]),/Item tidak berada/);
});

test('Grid Work Item wraps in title subcontainer; Project name and count share a wrapping left-aligned group in Grid/Gantt',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 assert.match(app,/grid-task-title-layout/);
 assert.match(app,/grid-task-title-text/);
 assert.match(app,/function projectFoldLabel\(group,view\)/);
 assert.match(app,/projectFoldLabel\(group,'Grid'\)/);
 assert.match(app,/projectFoldLabel\(group,'Gantt'\)/);
 assert.match(app,/project-fold-body/);
 assert.match(app,/project-fold-name/);
 assert.match(app,/project-group-count/);
 assert.doesNotMatch(app,/\$\{safe\(group\.name\)\} <small>\(\$\{group\.items\.length\}\)<\/small>/);
 assert.match(css,/\.grid-task-title-layout\s*\{display:flex/);
 assert.match(css,/\.grid-task-title-text\s*\{display:block/);
 assert.match(css,/\.project-fold-body>\.project-group-count\s*\{[^}]*white-space:nowrap/s);
 assert.match(css,/\.gantt-resizable \.gantt-project-heading \.project-fold-body>\.project-group-count/);
});

test('Management drag/reorder persists and uses safe per-type guards',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const migration=await readFile(new URL('../sql/016_management_item_order.sql',import.meta.url),'utf8');
 for(const str of ['data-management-grip','data-management-type="project"','data-management-type="category"','sortedManagementItems(\'project\')','sortedManagementItems(\'category\')','draggingManagement','reorderManagement','persistManagementOrder','saveManagementItemOrder'])assert.ok(app.includes(str),str);
 assert.match(app,/ArrowUp/);
 assert.match(app,/ArrowDown/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/public\.valid_management_item/);
 assert.match(migration,/updated_by=auth\.uid\(\)/);
 assert.match(migration,/primary key\(workspace_id,item_type,item_id\)/);
});
