import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

function demo(){
 const saved=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
 return saved;
}
test('Assigned By and link names persist; Completed names/URLs remain immutable but readable',async()=>{
 demo();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 const task=await store.saveTask({workspace_id:ws,title:'Named Attachment Regression',assigned_to:'u2',assigned_by:store.user.id,status:'In Progress',priority:'High',attachment_urls:['https://example.org/sop'],attachment_url:'https://example.org/sop',attachment_names:['SOP Final']});
 assert.equal(task.assigned_by,store.user.id);
 assert.deepEqual(task.attachment_names,['SOP Final']);
 const completed=await store.saveTask({...task,status:'Completed'});
 const updated=await store.saveTask({...completed,notes:'Signed off'});
 assert.deepEqual(updated.attachment_names,['SOP Final']);
 await assert.rejects(()=>store.saveTask({...updated,attachment_names:['Modified Name']}),/Attachment hanya dapat diubah/i);
 await assert.rejects(()=>store.saveTask({...updated,attachment_urls:[],attachment_url:'',attachment_names:[]}),/Attachment hanya dapat diubah/i);
 await store.initialize();
 assert.deepEqual(store.demo.tasks.find(t=>t.id===task.id).attachment_names,['SOP Final']);
 await assert.rejects(()=>store.saveTask({...completed,status:'In Progress',attachment_names:['Changed']}),/Attachment hanya dapat diubah/i);
});
test('Permanent delete requires archiving and Manager, and Project deletion retains Work Items',async()=>{
 demo();
 const {store}=await import('../public/store.js');
 await store.initialize();
 const ws=store.demo.workspaces[0].id;
 const project=await store.createProject({workspace_id:ws,name:'Delete only from archive',color:'#073b2d'});
 const t=await store.saveTask({workspace_id:ws,project_id:project.id,project_ids:[project.id],title:'Keep surviving task',assigned_to:'u3',status:'Not Started',priority:'Medium'});
 await assert.rejects(()=>store.deleteArchivedTask(ws,t.id),/diarsipkan terlebih dahulu/);
 await assert.rejects(()=>store.deleteArchivedProject(ws,project.id),/diarsipkan terlebih dahulu/);
 await store.archiveProject(ws,project.id);
 await store.deleteArchivedProject(ws,project.id);
 assert.ok(store.demo.tasks.some(x=>x.id===t.id),'Work Item must survive Project deletion');
 assert.equal(store.demo.tasks.find(x=>x.id===t.id).project_id,null);
 const t2=await store.saveTask({workspace_id:ws,title:'Delete archived task',status:'Completed',priority:'Medium'});
 await store.archiveTask(ws,t2.id);
 const user=store.user;
 store.user={id:'u3'};
 await assert.rejects(()=>store.deleteArchivedTask(ws,t2.id),/Manager atau Super Admin/);
 store.user=user;
 await store.deleteArchivedTask(ws,t2.id);
 assert.equal(store.demo.tasks.some(x=>x.id===t2.id),false);
});
test('Production UI provides Named Links, Assigned By, sticky Board/Grid and protected Archive delete',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../public/app.css',import.meta.url),'utf8');
 const migration=await readFile(new URL('../sql/017_assigned_by_named_attachments_archive_delete.sql',import.meta.url),'utf8');
 for(const key of ['assigned_by:data.assigned_by','data-attachment-name','attachment-named-link','data-action="permanent-delete-project"','data-action="permanent-delete-task"','deleteArchivedTask','deleteArchivedProject'])assert.ok(app.includes(key),key);
 assert.match(app,/function attachmentRow\(url='',name='',editable=true\)/);
 assert.match(app,/name==='assigned_by'\?'Assigned By'/);
 assert.match(app,/typed!=='HAPUS'/);
 assert.match(css,/\.kanban-col \.col-top\s*\{position:sticky/);
 assert.match(css,/\.grid-column-layout \.data-table\.grid-resizable thead th\s*\{position:sticky/);
 assert.match(migration,/before delete on public\.tasks/);
 assert.match(migration,/before delete on public\.projects/);
 assert.match(migration,/old\.archived_at is null/);
 assert.match(migration,/cardinality\(new\.attachment_names\)/);
});
