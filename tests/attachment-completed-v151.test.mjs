import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Existing attachment stays readable and immutable after Completed approval',async()=>{
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const original=store.demo.tasks[0];
 const link='https://example.org/signed-off-document';
 let task=await store.saveTask({...original,status:'In Progress',attachment_url:link,attachment_urls:[link]});
 task=await store.saveTask({...task,status:'Completed',notes:'Approved document',attachment_url:link,attachment_urls:[link]});
 assert.equal(task.status,'Completed');
 assert.equal(task.attachment_urls[0],link);
 task=await store.saveTask({...task,notes:'Manager added explanatory notes'});
 assert.equal(task.attachment_url,link);
 await assert.rejects(()=>store.saveTask({...task,attachment_url:'',attachment_urls:[]}),/Attachment hanya dapat diubah/i);
 await assert.rejects(()=>store.saveTask({...task,status:'In Progress',attachment_url:'https://example.org/replace',attachment_urls:['https://example.org/replace']}),/Attachment hanya dapat diubah/i);
 assert.equal(store.demo.tasks.find(x=>x.id===task.id).attachment_url,link);
 const inProgress=await store.saveTask({...task,status:'In Progress'});
 const updated=await store.saveTask({...inProgress,attachment_url:'https://example.org/revised',attachment_urls:['https://example.org/revised']});
 assert.equal(updated.attachment_url,'https://example.org/revised');
 const onHold=await store.saveTask({...updated,status:'On Hold'});
 await assert.rejects(()=>store.saveTask({...onHold,attachment_url:'',attachment_urls:[]}),/Attachment hanya dapat diubah/i);
 await assert.rejects(()=>store.saveTask({workspace_id:original.workspace_id,title:'Not Started Link',status:'Not Started',attachment_url:link,attachment_urls:[link]}),/Attachment hanya dapat ditambahkan/i);
});

test('Completed Work Item attachment shows readonly hyperlinks, no edit controls and backend migration guards updates',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const migration=await readFile(new URL('../sql/010_lock_approved_attachment_links.sql',import.meta.url),'utf8');
 assert.match(app,/function attachmentCanChange/);
 assert.match(app,/task\.status==='In Progress'/);
 assert.match(app,/data-attachment-viewer/);
 assert.match(app,/attachmentRow\(url,false\)/);
 assert.match(app,/target="_blank" rel="noopener noreferrer"/);
 assert.match(app,/data-attachment-editor/);
 assert.match(app,/attachmentCanChange\(current,data\.status\)/);
 assert.match(migration,/create trigger guard_task_attachment_changes/);
 assert.match(migration,/OLD\.status is distinct from 'In Progress'/);
 assert.match(migration,/NEW\.status is distinct from 'In Progress'/);
 assert.match(migration,/NEW\.attachment_urls is distinct from OLD\.attachment_urls/);
});
