import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const setup=()=>{
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 return storage;
};

test('Project order and Work Item width persist separately for each user and workspace',async()=>{
 setup();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const w=store.demo.workspaces[0].id;
 const projects=store.demo.projects.filter(p=>p.workspace_id===w).slice(0,3).map(p=>p.id);
 assert.ok(projects.length>=2,'demo should contain more than one Project');
 let updated=await store.saveViewPreferences(w,{project_order:projects.slice().reverse(),work_item_width:425});
 assert.deepEqual(updated.project_order,projects.slice().reverse());
 assert.equal(updated.work_item_width,425);
 assert.deepEqual((await store.loadWorkspace(w)).viewPreferences.project_order,projects.slice().reverse());
 await store.initialize();
 assert.equal((await store.loadWorkspace(w)).viewPreferences.work_item_width,425);
 updated=await store.saveViewPreferences(w,{work_item_width:640});
 assert.deepEqual(updated.project_order,projects.slice().reverse(),'resizing must keep the order');
 updated=await store.saveViewPreferences(w,{project_order:projects});
 assert.equal(updated.work_item_width,640,'reordering must keep column width');
 await assert.rejects(()=>store.saveViewPreferences(w,{work_item_width:801}),/190–800/);
 await assert.rejects(()=>store.saveViewPreferences(w,{project_order:[projects[0],projects[0]]}),/tidak valid/);
 const second=await store.createWorkspace('Alternative Workspace');
 assert.equal((await store.loadWorkspace(second.id)).viewPreferences,null,'preferences are workspace-specific');
});

test('Grid project drag and resize UI are connected and Gantt uses shared group order/width',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 const db=await readFile(new URL('../sql/015_workspace_view_preferences.sql',import.meta.url),'utf8');
 assert.match(app,/data-grid-project-grip/);
 assert.match(app,/data-grid-group/);
 assert.match(app,/draggingProjectId/);
 assert.match(app,/persistViewPreferences\(\{project_order:full\}/);
 assert.match(app,/sortProjectWorkItems/);
 assert.match(app,/rank=new Map\(\(S\.viewPreferences\?\.project_order/);
 assert.match(app,/workItemWidth\(\)/);
 assert.match(app,/class="gantt-scroller gantt-resizable"/);
 assert.match(app,/class="table-wrap grid-column-layout"/);
 assert.match(app,/data-resize-workitem/);
 assert.match(app,/pointermove/);
 assert.match(app,/pointercancel/);
 assert.match(app,/pointerup/);
 assert.match(app,/ArrowLeft/);
 assert.match(css,/\.gantt-resizable \.gantt-label/);
 assert.match(css,/\.grid-project-grip/);
 assert.match(css,/\.data-table\.grid-resizable/);
 assert.match(css,/overflow-wrap:anywhere/);
 assert.match(db,/enable row level security/);
 assert.match(db,/user_id=auth\.uid\(\)/);
});
