import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {filterPlannerReport,pdfSummary,pdfTimeline,downloadPlannerPDF} from '../public/pdf-report.js';

test('Reports filter by All, Member, Project, and Category without modifying source tasks',()=>{
 const tasks=[
  {id:'a',assigned_to:'u1',project_id:'p1',category_id:'c1',status:'In Progress',start_date:'2026-10-01',due_date:'2026-10-20'},
  {id:'b',assigned_to:'u2',project_id:'p2',category_id:'c2',status:'Completed',start_date:'2026-10-04',due_date:'2026-10-06'},
  {id:'c',assigned_to:'u1',project_id:'p2',category_id:'c1',status:'On Hold',start_date:'2026-10-07',due_date:'2026-10-28',completion_requested_at:'2026-10-15'}
 ];
 assert.equal(filterPlannerReport(tasks,{scope:'all'}).length,3);
 assert.deepEqual(filterPlannerReport(tasks,{scope:'user',id:'u1'}).map(x=>x.id),['a','c']);
 assert.deepEqual(filterPlannerReport(tasks,{scope:'project',id:'p2'}).map(x=>x.id),['b','c']);
 assert.deepEqual(filterPlannerReport(tasks,{scope:'category',id:'c1'}).map(x=>x.id),['a','c']);
 assert.throws(()=>filterPlannerReport(tasks,{scope:'user',id:''}),/Pilih/);
 assert.equal(tasks.length,3);
 const summary=pdfSummary(tasks,'2026-10-22');
 assert.deepEqual(summary,{total:3,inProgress:1,onHold:1,completed:1,pendingApproval:1,overdue:1});
 const timeline=pdfTimeline(tasks);
 assert.equal(timeline.start,'2026-10-01');assert.equal(timeline.end,'2026-10-28');
});

test('Generates one multipage PDF with executive KPI, Gantt and Grid, without sending task data to API',async()=>{
 const texts=[];
 class StubPDF{
  constructor(){this.pages=1;}
  setFillColor(){}rect(){}setTextColor(){}setFont(){}setFontSize(){}
  text(value){texts.push(String(value))}
  setDrawColor(){}line(){}roundedRect(){}circle(){}
  addPage(){this.pages++}
  save(name){this.savedFile=name;globalThis.__pdfOutput={pages:this.pages,name};}
 }
 globalThis.jspdf={jsPDF:StubPDF};
 const tasks=[{title:'SOP Pengadaan',assigned_to:'u1',project_id:'p1',category_id:'c1',status:'In Progress',start_date:'2026-10-22',due_date:'2026-10-26',priority:'High'}];
 const result=await downloadPlannerPDF({tasks,people:[{id:'u1',full_name:'Officer'}],projects:[{id:'p1',name:'Strategic'}],categories:[{id:'c1',name:'Operations'}],workspaceName:'ARF Management',selectionLabel:'All Work Items'});
 assert.ok(globalThis.__pdfOutput.pages>=3);
 assert.ok(texts.some(x=>x.includes('TOTAL WORK ITEMS')));
 assert.ok(texts.some(x=>x.includes('PENDING APPROVAL')));
 assert.ok(texts.some(x=>x.includes('OVERDUE TASKS')));
 assert.ok(texts.some(x=>x.includes('Timeline / Gantt')));
 assert.ok(texts.some(x=>x.includes('Grid / Work Item')));
 assert.ok(texts.some(x=>x.includes('SOP Pengadaan')));
 assert.match(result.filename,/\.pdf$/);
 delete globalThis.jspdf;
});

test('Checklist persists per Work Item in Demo Mode with add, toggle and delete',async()=>{
 const storage=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const t=store.demo.tasks[0],count=store.demo.tasks.length;
 const first=await store.addChecklistItem(t,'Review draft',0);
 const second=await store.addChecklistItem(t,'Approve SOP',1);
 assert.equal((await store.listTaskChecklist(t.id)).length,2);
 await store.setChecklistDone(t.id,first.id,true);
 assert.equal((await store.listTaskChecklist(t.id)).filter(x=>x.is_done).length,1);
 await store.deleteChecklistItem(t.id,second.id);
 assert.equal((await store.listTaskChecklist(t.id)).length,1);
 await store.initialize();
 assert.equal((await store.listTaskChecklist(t.id)).length,1);
 assert.equal(store.demo.tasks.length,count);
 await assert.rejects(()=>store.addChecklistItem(t,'',3),/Checklist/);
});

test('Task Chat sidebar is collapsible; report includes printable multi-page sections',async()=>{
 const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
 const sql=await readFile(new URL('../sql/007_task_checklist.sql',import.meta.url),'utf8');
 assert.match(app,/task-chat-aside/);
 assert.match(app,/case 'close-chat'/);
 assert.match(app,/checklistPanel/);
 assert.match(app,/case 'add-checklist'/);
 assert.match(app,/data-checklist-toggle/);
 assert.match(app,/case 'delete-checklist'/);
 assert.match(app,/if\(form.id==='reportForm'\)/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/task_checklist_update/);
 assert.match(sql,/on delete cascade/);
});
