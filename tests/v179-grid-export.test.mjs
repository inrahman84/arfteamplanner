import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGridExportData,taskInGridPeriod,createGridXlsx,downloadGridPDF} from '../public/grid-export.js';

const projects=[
 {id:'p1',name:'Curriculum',color:'#009b4c'},
 {id:'p2',name:'Infrastructure',color:'#3f6276'},
 {id:'p3',name:'Teacher Development',color:'#c89b55'}
];
const people=[{id:'u1',full_name:'Manager'},{id:'u2',full_name:'Teacher'}];
const categories=[{id:'c1',name:'Strategic'}];
const tasks=[
 {id:'t1',title:'Improve curriculum & learning',project_ids:['p1','p2'],status:'In Progress',priority:'High',assigned_by:'u1',assigned_to:'u2',category_id:'c1',start_date:'2026-10-01',due_date:'2026-11-15'},
 {id:'t2',title:'Review teacher training',project_ids:['p3'],status:'Completed',priority:'Medium',assigned_by:'u2',assigned_to:'u1',start_date:'2027-01-01',due_date:'2027-04-30'},
 {id:'t3',title:'Classroom upgrade',project_ids:['p2'],status:'Not Started',priority:'Critical',start_date:'2026-09-20',due_date:'2026-10-02'},
 {id:'t4',title:'No project yet',project_ids:[],status:'On Hold',priority:'Low',start_date:'2026-10-05',due_date:'2026-10-20'},
 {id:'t5',title:'Undated work',project_ids:['p1'],status:'Not Started',priority:'Medium',start_date:null,due_date:null}
];
const setup={tasks,projects,people,categories,format:'xlsx',rangeType:'dates',startDate:'2026-10-02',endDate:'2026-11-02'};
const report=more=>buildGridExportData({...setup,...more});
function zipEntries(binary){
 const buf=Buffer.from(binary),map=new Map();let at=0;
 while(at+30<=buf.length&&buf.readUInt32LE(at)===0x04034b50){
  const n=buf.readUInt16LE(at+26),e=buf.readUInt16LE(at+28),size=buf.readUInt32LE(at+18);
  const name=buf.subarray(at+30,at+30+n).toString('utf8');
  const start=at+30+n+e;map.set(name,buf.subarray(start,start+size).toString('utf8'));at=start+size;
 }
 return map;
}

test('Grid export matches inclusive date intervals and excludes undated tasks',()=>{
 assert.ok(taskInGridPeriod(tasks[0],'2026-11-15','2026-11-15'));
 assert.ok(taskInGridPeriod(tasks[2],'2026-10-02','2026-10-02'));
 assert.equal(taskInGridPeriod(tasks[2],'2026-10-03','2026-10-09'),false);
 assert.equal(taskInGridPeriod(tasks[4],'2026-10-01','2026-12-31'),false);
 const one=report({selectedProjectIds:['p2']});
 assert.deepEqual(one.groups.map(g=>g.name),['Infrastructure']);
 assert.deepEqual(one.groups[0].rows.map(x=>x.id),['t3','t1']);
 assert.equal(one.taskCount,2);
 assert.equal(one.rowCount,2);
 assert.equal(one.groups[0].rows.find(x=>x.id==='t1').assignedBy,'Manager');
});

test('Selected Projects are grouped, unique counts dedupe cross-linked Work Items',()=>{
 const data=report({selectedProjectIds:['p1','p2'],includeUnassigned:true,positions:[{project_id:'p2',task_id:'t1',sort_order:0},{project_id:'p2',task_id:'t3',sort_order:1}]});
 assert.deepEqual(data.groups.map(g=>g.name),['Curriculum','Infrastructure','Tanpa Project']);
 assert.equal(data.taskCount,3);
 assert.equal(data.rowCount,4);
 assert.deepEqual(data.groups[1].rows.map(x=>x.id),['t1','t3']);
 assert.ok(data.groups[0].rows[0].allProjects.includes('Infrastructure'));
});

test('Year ranges, bad ranges, unknown project IDs, empty selections are validated',()=>{
 const yearly=report({rangeType:'years',startYear:2026,endYear:2027,selectedProjectIds:['p3']});
 assert.equal(yearly.range.startDate,'2026-01-01');
 assert.equal(yearly.range.endDate,'2027-12-31');
 assert.deepEqual(yearly.groups[0].rows.map(x=>x.id),['t2']);
 assert.throws(()=>report({selectedProjectIds:[]}),/Centang/);
 assert.throws(()=>report({selectedProjectIds:['p999']}),/tidak valid/);
 assert.throws(()=>report({selectedProjectIds:['p1'],startDate:'2026-11-10',endDate:'2026-10-01'}),/valid/);
 assert.throws(()=>report({selectedProjectIds:['p1'],rangeType:'years',startYear:2026,endYear:2039}),/10 tahun/);
 assert.throws(()=>report({selectedProjectIds:['p1'],format:'csv'}),/XLSX atau PDF/);
});

test('Native XLSX is a valid Office ZIP containing grouped Grid rows and escaped content',()=>{
 const data=report({selectedProjectIds:['p1','p2'],includeUnassigned:true});
 const bytes=createGridXlsx(data,'ARF & Foundation');
 assert.ok(bytes instanceof Uint8Array&&bytes.length>2000);
 const parts=zipEntries(bytes);
 for(const name of ['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','xl/worksheets/sheet1.xml'])assert.ok(parts.has(name),name);
 const sheet=parts.get('xl/worksheets/sheet1.xml');
 assert.ok(sheet.includes('GRID VIEW REPORT'));
 assert.ok(sheet.includes('ARF &amp; Foundation'));
 assert.ok(sheet.includes('Improve curriculum &amp; learning'));
 assert.ok(sheet.includes('Infrastructure'));
 assert.ok(sheet.includes('Assigned By'));
 assert.ok(sheet.includes('Unique Work Items: 3'));
 assert.ok(sheet.includes('mergeCell'));
 assert.ok(parts.get('xl/styles.xml').includes('FF009B4C'));
});

test('PDF Grid exporter creates printable landscape report',async()=>{
 const calls=[];
 class FakePDF{
  constructor(opts){this.options=opts;this.pages=1;}
  setFillColor(){} rect(){} setTextColor(){} setFont(){} setFontSize(){}
  text(x){calls.push(String(x));}
  addPage(){this.pages++;}
  save(x){this.filename=x;}
 }
 globalThis.jspdf={jsPDF:FakePDF};
 try{
  const out=await downloadGridPDF(report({selectedProjectIds:['p1','p2']}),'ARF');
  assert.match(out.filename,/\.pdf$/);
  assert.equal(out.workItems,2);
  assert.ok(calls.some(v=>v.includes('GRID REPORT')));
  assert.ok(calls.some(v=>v.includes('Curriculum')));
 }finally{delete globalThis.jspdf;}
});

test('Grid toolbar offers XLSX/PDF modal, checked Projects and date/year periods',()=>{
 const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
 for(const t of ['Export XLSX / PDF','export-grid','gridExportForm','data-change="grid-export-period"','export_project_ids','export_unassigned','grid-export-select-all','grid-export-clear','downloadGridXLSX','downloadGridPDF','gridExport:{title:'])assert.ok(app.includes(t),t);
 assert.match(app,/form\.id==='gridExportForm'/);
 assert.match(app,/if\(data\.format==='xlsx'\)downloadGridXLSX/);
 assert.match(css,/\.grid-export-project-list/);
 // Other CSV tools may remain in Settings; Grid must not present the old button.
 const grid=app.slice(app.indexOf('function grid(){'),app.indexOf('function gantt(){'));
 assert.ok(!grid.includes("'export-csv'"));
});
