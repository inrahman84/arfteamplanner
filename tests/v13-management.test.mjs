import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('V1.3: deleting projects/categories preserves work items and member overrides stay workspace-scoped',async()=>{
 const data=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 const total=store.demo.tasks.length;
 const linkedProject=store.demo.tasks.find(t=>t.project_id);
 const oldProject=linkedProject.project_id;
 await store.archiveProject(ws,oldProject);
 await store.deleteArchivedProject(ws,oldProject);
 assert.equal(store.demo.tasks.length,total);
 assert.equal(store.demo.tasks.filter(t=>t.project_id===oldProject).length,0);
 const linkedCategory=store.demo.tasks.find(t=>t.category_id);
 const oldCategory=linkedCategory.category_id;
 await store.deleteCategory(ws,oldCategory);
 assert.equal(store.demo.tasks.length,total);
 assert.equal(store.demo.tasks.filter(t=>t.category_id===oldCategory).length,0);
 const userId='u2',original=store.demo.people.find(p=>p.id===userId).full_name;
 await store.updateMemberDetails(ws,userId,'Nama Workspace','Education Specialist');
 const updated=await store.loadWorkspace(ws);
 assert.equal(updated.people.find(p=>p.id===userId).full_name,'Nama Workspace');
 assert.equal(updated.people.find(p=>p.id===userId).job_title,'Education Specialist');
 assert.equal(store.demo.people.find(p=>p.id===userId).full_name,original);
 const order=['u4','u2','u1','u3'];
 await store.saveWorkloadOrder(ws,order);
 assert.deepEqual((await store.loadWorkspace(ws)).workloadPositions.sort((a,b)=>a.sort_order-b.sort_order).map(r=>r.user_id),order);
 assert.equal(store.demo.tasks.length,total);
});

test('V1.3 UI exposes protected Settings delete, member editor and draggable workload',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const sql=await readFile(new URL('../sql/005_workspace_management_v13.sql',import.meta.url),'utf8');
 for(const needle of ["case 'delete-project'","case 'delete-category'","case 'edit-member'","if(form.id==='memberForm')","draggable=\"\${canManage()}\"","saveWorkloadOrder"])assert.ok(app.includes(needle),needle);
 assert.match(sql,/on delete cascade/i);
 assert.match(sql,/workload_positions_update[\s\S]*?has_workspace_role/i);
 assert.match(sql,/add column if not exists display_name/i);
});
