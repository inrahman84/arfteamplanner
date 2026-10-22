import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeAttachmentUrls} from '../public/core.js';

test('HTTPS attachment lists validate order, duplicates, maximum count and URL scheme',()=>{
 assert.deepEqual(normalizeAttachmentUrls([' https://drive.google.com/file/1 ','https://example.org/doc']),['https://drive.google.com/file/1','https://example.org/doc']);
 assert.deepEqual(normalizeAttachmentUrls(['','   ']),[]);
 assert.throws(()=>normalizeAttachmentUrls(['http://example.org/file']),/HTTPS/);
 assert.throws(()=>normalizeAttachmentUrls(['javascript:alert(1)']),/HTTPS/);
 assert.throws(()=>normalizeAttachmentUrls(['https://example.org/file','https://example.org/file']),/duplikat/i);
 assert.throws(()=>normalizeAttachmentUrls(Array.from({length:21},(_,i)=>'https://example.org/'+i)),/Maksimal 20/);
});

test('Demo add/delete links saves changes without losing Work Item and migrates legacy URL',async()=>{
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const t=store.demo.tasks[0],originalCount=store.demo.tasks.length;
 assert.equal(t.attachment_urls[0],t.attachment_url);
 await store.saveTask({...t,attachment_urls:['https://example.org/a','https://example.org/b']});
 let saved=store.demo.tasks.find(x=>x.id===t.id);
 assert.deepEqual(saved.attachment_urls,['https://example.org/a','https://example.org/b']);
 assert.equal(saved.attachment_url,'https://example.org/a');
 await store.saveTask({...saved,attachment_urls:['https://example.org/b']});
 saved=store.demo.tasks.find(x=>x.id===t.id);
 assert.deepEqual(saved.attachment_urls,['https://example.org/b']);
 await store.saveTask({...saved,attachment_urls:[]});
 assert.deepEqual(store.demo.tasks.find(x=>x.id===t.id).attachment_urls,[]);
 assert.equal(store.demo.tasks.find(x=>x.id===t.id).attachment_url,'');
 assert.equal(store.demo.tasks.length,originalCount);
 await store.initialize();
 assert.deepEqual(store.demo.tasks.find(x=>x.id===t.id).attachment_urls,[]);
});

test('Form includes explicit add/remove buttons and migration preserves legacy links',async()=>{
 const {readFile}=await import('node:fs/promises');
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const sql=await readFile(new URL('../sql/006_multiple_https_attachments.sql',import.meta.url),'utf8');
 assert.match(app,/case 'add-attachment'/);
 assert.match(app,/case 'remove-attachment'/);
 assert.match(app,/data-attachment-input/);
 assert.match(app,/normalizeAttachmentUrls/);
 assert.match(app,/attachment_url:attachment_urls\[0\]\|\|''/);
 assert.match(sql,/attachment_urls text\[\]/);
 assert.match(sql,/set attachment_urls=array\[attachment_url\]/);
 assert.match(sql,/tasks_attachment_urls_valid/);
});
